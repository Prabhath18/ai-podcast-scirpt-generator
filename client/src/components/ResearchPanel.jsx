import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelSkeleton } from './Skeletons.jsx';
import { api, ApiError } from '../services/api.js';
import { getDemoResearch } from '../services/demoData.js';
import { OUTLINE_LIMITS } from '../hooks/constants.js';

const DISCLAIMER = 'Suggested sources: verify before citing.';

function SourceItem({ source, pinned, canPin, onPin, onUnpin }) {
  return (
    <li className="py-3">
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent">
        {source.title}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {(source.source || source.publishedAt) && (
        <p className="tabular mt-0.5 font-mono text-2xs text-ink-faint">{[source.source, source.publishedAt].filter(Boolean).join(' · ')}</p>
      )}
      {source.summary && <p className="mt-1 max-w-measure text-sm text-ink-muted">{source.summary}</p>}
      <div className="mt-1.5">
        {pinned ? (
          <button type="button" className="link-action" data-active="true" onClick={onUnpin} aria-label={`Unpin ${source.title}`}>
            Pinned. Unpin
          </button>
        ) : (
          <button type="button" className="link-action" disabled={!canPin} onClick={onPin} aria-label={`Pin ${source.title} to this segment`}>
            Pin to segment
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Source suggestions for a segment or the whole topic. Every item comes from
 * a real API result (Wikipedia; NewsAPI only when the server has a key) via
 * the server's /api/research proxy. Demo outlines use bundled sample results
 * so this works offline.
 */
export default function ResearchPanel({ workspace, segment, scope, onScopeChange }) {
  const { outline, form, demoId, pinSource, unpinSource } = workspace;
  const topic = form.topic.trim() || outline.episode_title;
  const target = scope === 'segment' && segment ? segment : null;
  const targetId = target?.id ?? null;
  const targetTitle = target?.title ?? null;
  const defaultQuery = targetTitle ?? topic;

  const [query, setQuery] = useState(defaultQuery);
  const [state, setState] = useState({ status: 'loading', data: null, message: null });
  const [attempt, setAttempt] = useState(0);
  const memo = useRef(new Map());

  // A new segment or scope resets the search box to that segment's title (or the topic).
  useEffect(() => setQuery(defaultQuery), [defaultQuery]);

  const search = useCallback(
    async (text, signal) => {
      const key = `${text}|${targetId ?? 'topic'}`;
      if (demoId) {
        const results = getDemoResearch(demoId, targetId);
        setState({ status: 'ready', data: { wikipedia: { results, error: null }, news: { enabled: false, results: [] }, demo: true }, message: null });
        return;
      }
      if (memo.current.has(key)) {
        setState({ status: 'ready', data: memo.current.get(key), message: null });
        return;
      }
      setState((prev) => ({ ...prev, status: 'loading' }));
      try {
        // The automatic search uses the topic plus the segment title; a typed search uses only the typed text.
        const typed = text !== defaultQuery;
        const params = new URLSearchParams(typed ? { topic: text } : targetTitle ? { topic, segmentTitle: targetTitle } : { topic });
        const data = await api.get(`/api/research?${params}`, { signal });
        if (!data.wikipedia.error && !data.news.error) memo.current.set(key, data);
        setState({ status: 'ready', data, message: null });
      } catch (err) {
        if (err.name === 'AbortError') return;
        setState({ status: 'error', data: null, message: err instanceof ApiError ? err.message : 'Could not reach the research service.' });
      }
    },
    [defaultQuery, targetId, targetTitle, topic, demoId],
  );

  useEffect(() => {
    const controller = new AbortController();
    search(defaultQuery, controller.signal);
    return () => controller.abort();
  }, [defaultQuery, attempt, search]);

  const pinnedUrls = new Set((target?.sources || []).map((s) => s.url));
  const canPin = Boolean(target) && (target.sources || []).length < OUTLINE_LIMITS.MAX_SOURCES_PER_SEGMENT;
  const pin = (source) => pinSource(target.id, source);
  const unpin = (source) => unpinSource(target.id, source);

  const wiki = state.data?.wikipedia;
  const news = state.data?.news;

  return (
    <div>
      <div role="radiogroup" aria-label="Research scope" className="mb-3 inline-flex rounded border border-line-strong bg-sunken p-0.5 text-sm">
        {[
          ['segment', 'This segment', Boolean(segment)],
          ['topic', 'Whole topic', true],
        ].map(([value, label, available]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={scope === value}
            disabled={!available}
            onClick={() => onScopeChange(value)}
            className={`rounded-sm px-2.5 py-0.5 disabled:opacity-40 ${scope === value ? 'bg-page font-medium text-ink shadow-[0_0_0_1px_rgb(var(--line-strong))]' : 'text-ink-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {!demoId && (
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) search(query.trim());
        }}
      >
        <label className="sr-only" htmlFor="research-query">Search Wikipedia</label>
        <input id="research-query" className="field" value={query} maxLength={200} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className="btn shrink-0" disabled={!query.trim()}>Search</button>
      </form>
      )}

      <p className="mt-3 text-xs text-ink-faint">{state.data?.demo ? 'Sample sources for this demo. ' : ''}{DISCLAIMER}</p>

      {state.status === 'loading' && <div className="mt-4"><PanelSkeleton lines={7} /></div>}

      {state.status === 'error' && (
        <div className="mt-4 rounded-md border border-danger/40 bg-danger-tint p-3 text-sm text-danger" role="alert">
          <p>{state.message}</p>
          <button type="button" className="link-action mt-2 !text-danger" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && wiki && (
        <div className="mt-4">
          <h3 className="label">Wikipedia</h3>
          {wiki.error ? (
            <div className="mt-2 text-sm text-danger" role="alert">
              {wiki.error}{' '}
              <button type="button" className="link-action !text-danger" onClick={() => { memo.current.clear(); setAttempt((a) => a + 1); }}>Try again</button>
            </div>
          ) : wiki.results.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Nothing on Wikipedia matched “{query}”. Try a broader phrase in the search box.</p>
          ) : (
            <ul className="divide-y divide-line">
              {wiki.results.map((source) => (
                <SourceItem key={source.url} source={source} pinned={pinnedUrls.has(source.url)} canPin={canPin} onPin={() => pin(source)} onUnpin={() => unpin(source)} />
              ))}
            </ul>
          )}
          {!target && wiki.results.length > 0 && <p className="mt-2 text-xs text-ink-faint">Choose “This segment” to pin a source to it.</p>}
        </div>
      )}

      {state.status === 'ready' && news?.enabled && (
        <div className="mt-6">
          <h3 className="label">Recent news</h3>
          {news.error ? (
            <p className="mt-2 text-sm text-ink-muted">{news.error}</p>
          ) : news.results.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">No recent articles found.</p>
          ) : (
            <ul className="divide-y divide-line">
              {news.results.map((source) => (
                <SourceItem key={source.url} source={source} pinned={pinnedUrls.has(source.url)} canPin={canPin} onPin={() => pin(source)} onUnpin={() => unpin(source)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
