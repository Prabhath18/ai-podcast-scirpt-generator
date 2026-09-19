// Source suggestions for the Research panel. Every item returned comes from a
// real API response: Wikipedia's public Action API (no key) and, only when
// NEWS_API_KEY is set, NewsAPI. Nothing here asks an LLM for facts, and each
// call has a timeout so a slow upstream can't hang the request.
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const NEWS_API = 'https://newsapi.org/v2/everything';
const USER_AGENT = 'PodcastOutlineAI/1.0 (educational project)';
const TIMEOUT_MS = 6000;
const MAX_RESULTS = 5;

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
    });
    if (!response.ok) {
      const error = new Error(`Upstream responded with ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Strips markup and collapses whitespace, then truncates on a word boundary. */
export function cleanText(value, max) {
  const text = String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** Search text for the API: drops punctuation such as the ":" in "Part one: Part two". */
export function toSearchQuery(text) {
  return String(text ?? '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export async function searchWikipedia(query) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: String(MAX_RESULTS + 2),
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    exsentences: '2',
    exlimit: 'max',
  });
  const data = await fetchJson(`${WIKI_API}?${params}`);
  const pages = Array.isArray(data?.query?.pages) ? data.query.pages : [];

  return pages
    .filter((page) => typeof page.title === 'string' && page.extract && !/may refer to:?$/i.test(page.extract.trim().split('\n')[0]))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .slice(0, MAX_RESULTS)
    .map((page) => ({
      type: 'wikipedia',
      title: cleanText(page.title, 120),
      summary: cleanText(page.extract, 300),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    }));
}

/** Tries each query in turn and returns the first non-empty result set. */
export async function findWikipediaSources(queries) {
  for (const query of queries) {
    if (!query) continue;
    // eslint-disable-next-line no-await-in-loop -- fall back to the next query only if this one finds nothing
    const results = await searchWikipedia(query);
    if (results.length > 0) return results;
  }
  return [];
}

export function newsEnabled() {
  return Boolean(process.env.NEWS_API_KEY);
}

export async function searchNews(query) {
  const params = new URLSearchParams({ q: query, pageSize: String(MAX_RESULTS), sortBy: 'relevancy', language: 'en' });
  const data = await fetchJson(`${NEWS_API}?${params}`, { 'X-Api-Key': process.env.NEWS_API_KEY });
  const articles = Array.isArray(data?.articles) ? data.articles : [];

  return articles
    .filter((article) => article?.title && isHttpUrl(article.url))
    .slice(0, MAX_RESULTS)
    .map((article) => ({
      type: 'news',
      title: cleanText(article.title, 160),
      summary: cleanText(article.description, 240),
      url: article.url,
      source: cleanText(article.source?.name, 80),
      publishedAt: typeof article.publishedAt === 'string' ? article.publishedAt.slice(0, 10) : '',
    }));
}
