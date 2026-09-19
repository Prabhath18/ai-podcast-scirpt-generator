import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';
import { clearCache } from '../utils/memoryCache.js';
import { cleanText, toSearchQuery } from '../services/research.js';

function wikiResponse(pages) {
  return { ok: true, status: 200, json: async () => ({ query: { pages } }) };
}

const PAGES = [
  { pageid: 2, index: 2, title: 'Bebop', extract: 'Bebop is a style of jazz.\nIt developed in the 1940s.' },
  { pageid: 1, index: 1, title: 'Jazz', extract: 'Jazz is a music genre that originated in the African-American communities of New Orleans.' },
  { pageid: 3, index: 3, title: 'Jazz (disambiguation)', extract: 'Jazz may refer to:' },
];

describe('GET /api/research (Wikipedia proxy, fetch mocked)', () => {
  let app;
  const fetchMock = vi.fn();

  beforeEach(() => {
    ({ app } = createTestApp());
    clearCache();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.NEWS_API_KEY;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns title, short summary and a wikipedia link, ordered by search rank', async () => {
    fetchMock.mockResolvedValueOnce(wikiResponse(PAGES));
    const res = await request(app).get('/api/research').query({ topic: 'Jazz history' });

    expect(res.status).toBe(200);
    const { results } = res.body.wikipedia;
    expect(results.map((r) => r.title)).toEqual(['Jazz', 'Bebop']); // disambiguation page dropped
    expect(results[0].url).toBe('https://en.wikipedia.org/wiki/Jazz');
    expect(results[0].type).toBe('wikipedia');
    expect(res.body.disclaimer).toMatch(/verify before citing/i);
    expect(res.body.news.enabled).toBe(false);
  });

  it('calls Wikipedia with a User-Agent and never sends any key', async () => {
    fetchMock.mockResolvedValueOnce(wikiResponse(PAGES));
    await request(app).get('/api/research').query({ topic: 'Jazz' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('en.wikipedia.org/w/api.php');
    expect(options.headers['User-Agent']).toMatch(/PodcastOutlineAI/);
    expect(options.headers['X-Api-Key']).toBeUndefined();
  });

  it('falls back to the topic when the segment title finds nothing', async () => {
    fetchMock
      .mockResolvedValueOnce(wikiResponse([]))
      .mockResolvedValueOnce(wikiResponse([]))
      .mockResolvedValueOnce(wikiResponse(PAGES));
    const res = await request(app).get('/api/research').query({ topic: 'Jazz', segmentTitle: 'Obscure: thing' });
    expect(res.body.wikipedia.results).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns an empty list, not an error, when nothing matches', async () => {
    fetchMock.mockResolvedValue(wikiResponse([]));
    const res = await request(app).get('/api/research').query({ topic: 'zzzzqqqq' });
    expect(res.status).toBe(200);
    expect(res.body.wikipedia).toEqual({ results: [], error: null });
  });

  it('reports an upstream failure in the response body instead of failing the request', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const res = await request(app).get('/api/research').query({ topic: 'Jazz' });
    expect(res.status).toBe(200);
    expect(res.body.wikipedia.error).toMatch(/unavailable/i);
    expect(res.body.wikipedia.results).toEqual([]);
  });

  it('caches successful lookups and does not cache failures', async () => {
    fetchMock.mockResolvedValue(wikiResponse(PAGES));
    await request(app).get('/api/research').query({ topic: 'Jazz' });
    const second = await request(app).get('/api/research').query({ topic: 'Jazz' });
    expect(second.body.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearCache();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await request(app).get('/api/research').query({ topic: 'Blues' });
    await request(app).get('/api/research').query({ topic: 'Blues' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a missing topic', async () => {
    const res = await request(app).get('/api/research');
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('includes news only when NEWS_API_KEY is set, sending the key as a header', async () => {
    process.env.NEWS_API_KEY = 'test-key';
    fetchMock.mockImplementation(async (url) =>
      url.includes('newsapi.org')
        ? {
            ok: true,
            status: 200,
            json: async () => ({
              articles: [
                { title: 'Jazz revival', url: 'https://example.com/a', description: '<b>Big</b> news', source: { name: 'Example' }, publishedAt: '2026-01-02T10:00:00Z' },
                { title: 'Bad link', url: 'javascript:alert(1)' },
              ],
            }),
          }
        : wikiResponse(PAGES),
    );
    const res = await request(app).get('/api/research').query({ topic: 'Jazz' });

    expect(res.body.news.enabled).toBe(true);
    expect(res.body.news.results).toEqual([
      { type: 'news', title: 'Jazz revival', summary: 'Big news', url: 'https://example.com/a', source: 'Example', publishedAt: '2026-01-02' },
    ]);
    const newsCall = fetchMock.mock.calls.find(([url]) => url.includes('newsapi.org'));
    expect(newsCall[0]).not.toContain('test-key');
    expect(newsCall[1].headers['X-Api-Key']).toBe('test-key');
  });

  it('still returns Wikipedia results when NewsAPI refuses the request', async () => {
    process.env.NEWS_API_KEY = 'test-key';
    fetchMock.mockImplementation(async (url) =>
      url.includes('newsapi.org') ? { ok: false, status: 426, json: async () => ({}) } : wikiResponse(PAGES),
    );
    const res = await request(app).get('/api/research').query({ topic: 'Jazz' });
    expect(res.body.wikipedia.results).toHaveLength(2);
    expect(res.body.news.error).toMatch(/localhost/i);
  });
});

describe('research text helpers', () => {
  it('strips markup and truncates on a word boundary', () => {
    expect(cleanText('<p>Hello   <b>world</b></p>', 50)).toBe('Hello world');
    expect(cleanText('one two three four five', 12)).toBe('one two…');
  });

  it('removes punctuation from search text', () => {
    expect(toSearchQuery('The Hidden Costs: Skill Atrophy & Silent Bugs')).toBe('The Hidden Costs Skill Atrophy Silent Bugs');
  });
});
