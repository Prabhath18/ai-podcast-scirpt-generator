import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { researchLimiter } from '../middleware/rateLimiter.js';
import { validateResearchRequest } from '../validators/requestValidators.js';
import { getCached, setCached, hashKey } from '../utils/memoryCache.js';
import { findWikipediaSources, searchNews, newsEnabled, toSearchQuery } from '../services/research.js';

export const researchRouter = Router();
researchRouter.use(researchLimiter);

const CACHE_TTL_MS = 60 * 60 * 1000;
const DISCLAIMER = 'Suggested sources: verify before citing.';

function upstreamMessage(err, provider) {
  if (err.name === 'AbortError') return `${provider} took too long to respond.`;
  if (provider === 'NewsAPI' && [401, 426, 429].includes(err.status)) {
    return 'NewsAPI refused the request. Free keys only work from localhost and have a daily limit.';
  }
  return `${provider} is unavailable right now.`;
}

// GET /api/research?topic=...&segmentTitle=...
// One panel request runs one Wikipedia lookup (plus one news lookup when a
// key is configured). A failure in either provider is reported in its own
// block so the other still renders.
researchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { topic, segmentTitle } = req.query;
    const { valid, errors } = validateResearchRequest({ topic, segmentTitle });
    if (!valid) {
      const error = new Error('Request failed validation.');
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const withNews = newsEnabled();
    const cacheKey = hashKey({ kind: 'research', topic, segmentTitle: segmentTitle || '', withNews });
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const topicQuery = toSearchQuery(topic);
    const segmentQuery = segmentTitle ? toSearchQuery(segmentTitle) : '';
    // Prefer the segment's own title; fall back to the whole topic if it finds nothing.
    const wikiQueries = segmentQuery ? [`${segmentQuery} ${topicQuery}`.slice(0, 200), segmentQuery, topicQuery] : [topicQuery];

    const [wiki, news] = await Promise.allSettled([
      findWikipediaSources(wikiQueries),
      withNews ? searchNews(segmentQuery || topicQuery) : Promise.resolve([]),
    ]);

    const body = {
      wikipedia:
        wiki.status === 'fulfilled'
          ? { results: wiki.value, error: null }
          : { results: [], error: upstreamMessage(wiki.reason, 'Wikipedia') },
      news: {
        enabled: withNews,
        ...(news.status === 'fulfilled'
          ? { results: news.value, error: null }
          : { results: [], error: upstreamMessage(news.reason, 'NewsAPI') }),
      },
      disclaimer: DISCLAIMER,
    };

    if (!body.wikipedia.error && !body.news.error) setCached(cacheKey, body, CACHE_TTL_MS);
    res.json({ ...body, cached: false });
  }),
);
