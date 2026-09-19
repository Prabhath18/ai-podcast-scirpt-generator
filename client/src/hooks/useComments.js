import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../services/api.js';
import { nameFromEmail } from '../utils/relativeTime.js';

const POLL_MS = 30000;

/**
 * Comments for the open episode, from one of three places:
 *   'owner'   /api/projects/:id/comments        the signed-in owner of a saved project
 *   'shared'  /api/shared/:token/comments       a signed-in visitor on a share link
 *   'local'   the workspace itself              the bundled demos (browser-only samples)
 *   'none'    nothing to load (logged out, or the project isn't saved yet)
 * The hook polls every 30 seconds while `polling` is true (the panel is open),
 * and refreshes at once whenever `refreshSignal` changes (the user just opened
 * the panel on a segment); there are no websockets. Every call has the same shape whatever the source.
 */
export function useComments({ mode, projectId, token, enabled = true, polling = false, refreshSignal = 0, user, workspace }) {
  const path = mode === 'owner' ? `/api/projects/${projectId}/comments` : mode === 'shared' ? `/api/shared/${token}/comments` : null;
  const userId = user?.id ?? null;
  const [remote, setRemote] = useState({ comments: [], status: 'idle', message: null });
  const currentPath = useRef(path);
  currentPath.current = path;

  const refresh = useCallback(async () => {
    if (!path) return;
    try {
      const data = await api.get(path);
      if (currentPath.current !== path) return; // the episode changed while this was in flight
      setRemote({ comments: data.comments, status: 'ready', message: null });
    } catch (err) {
      if (currentPath.current !== path) return;
      const code = err instanceof ApiError ? err.code : null;
      const status = code === 'UNAUTHENTICATED' ? 'login' : code === 'COMMENTS_DISABLED' ? 'disabled' : 'error';
      setRemote((prev) => ({ comments: status === 'error' ? prev.comments : [], status, message: err.message }));
    }
  }, [path]);

  // Load on open, and again when the project or the signed-in user changes.
  useEffect(() => {
    if (!path || !enabled) {
      setRemote({ comments: [], status: 'idle', message: null });
      return;
    }
    setRemote((prev) => ({ ...prev, status: prev.status === 'ready' ? 'ready' : 'loading' }));
    refresh();
  }, [path, enabled, userId, refresh]);

  useEffect(() => {
    if (!path || !enabled || !polling) return undefined;
    refresh(); // opening the panel shows what arrived since the last look, without waiting for the first tick
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [path, enabled, polling, refreshSignal, refresh]);

  const remoteActions = useMemo(
    () => ({
      add: async ({ segmentId, body }) => {
        const data = await api.post(path, { body, segmentId });
        setRemote((prev) => ({ ...prev, comments: [...prev.comments, data.comment] }));
      },
      setResolved: async (id, resolved) => {
        const data = await api.patch(`${path}/${id}`, { resolved });
        setRemote((prev) => ({ ...prev, comments: prev.comments.map((c) => (c.id === id ? data.comment : c)) }));
      },
      remove: async (id) => {
        await api.delete(`${path}/${id}`);
        setRemote((prev) => ({ ...prev, comments: prev.comments.filter((c) => c.id !== id) }));
      },
    }),
    [path],
  );

  if (mode === 'local') {
    return {
      mode,
      comments: workspace.localComments,
      status: 'ready',
      message: null,
      refresh: async () => {},
      add: async ({ segmentId, body }) =>
        workspace.addLocalComment({ segmentId, body, createdAt: new Date().toISOString(), author: { name: user ? nameFromEmail(user.email) : 'you' } }),
      setResolved: async (id, resolved) => workspace.resolveLocalComment(id, resolved),
      remove: async (id) => workspace.deleteLocalComment(id),
    };
  }

  return { mode, ...remote, refresh, ...remoteActions };
}

/** Open (unresolved) comment counts per segment, for the badges on each segment row. */
export function openCountsBySegment(comments) {
  const counts = {};
  for (const comment of comments) {
    if (!comment.resolved && comment.segmentId != null) counts[comment.segmentId] = (counts[comment.segmentId] || 0) + 1;
  }
  return counts;
}
