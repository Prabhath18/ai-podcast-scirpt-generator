import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { api } from '../services/api.js';
import { segmentContentKey } from '../utils/segmentSnapshot.js';
import { sumDurations } from '../utils/durationMath.js';
import { useToast } from './useToast.jsx';
import { useAuth } from './useAuth.jsx';
import { getDemo } from '../services/demoData.js';
import { EMPTY_STATE, STORAGE_KEY, loadInitialState, reducer } from './workspaceReducer.js';

// Actions that replace the whole working podcast. Answers to requests made for the
// podcast that was on screen before one of these must not be written into the new one.
const REPLACES_PODCAST = new Set(['NEW_PODCAST', 'LOAD_PROJECT', 'LOAD_DEMO', 'RESET']);

/**
 * The single source of truth for the episode being edited: the brief (form),
 * the outline, cached Deep Dives, and save/share state. Every edit goes
 * through the reducer in workspaceReducer.js and the whole state is mirrored
 * to localStorage, so a refresh or an anonymous session never loses work. When the
 * session ends (logout, expiry, or a sign-out in another tab) the whole state is
 * reset and the stored draft is removed rather than rewritten.
 */
export function useOutlineWorkspace() {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadInitialState());
  const toast = useToast();
  const { sessionEpoch } = useAuth();
  const { outline } = state;
  const podcastEpoch = useRef(0);

  useEffect(() => {
    try {
      // The empty state is "nothing to keep": remove the key instead of writing it back,
      // so a reset (or a fresh visit) leaves localStorage genuinely empty.
      if (state === EMPTY_STATE) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable -- editing still works in-memory */
    }
  }, [state]);

  // A session ended somewhere: forget the outline, Deep Dives, open project and share state.
  const seenEpoch = useRef(sessionEpoch);
  useEffect(() => {
    if (seenEpoch.current === sessionEpoch) return;
    seenEpoch.current = sessionEpoch;
    podcastEpoch.current += 1;
    dispatch({ type: 'RESET' });
  }, [sessionEpoch]);

  const resolvedTone = state.form.tone === 'Other' ? state.form.customTone.trim() : state.form.tone;

  const send = useCallback((type, payload) => {
    if (REPLACES_PODCAST.has(type)) podcastEpoch.current += 1;
    dispatch({ type, ...payload });
  }, []);

  /**
   * Call before starting a request that will write into the podcast on screen. The function it
   * returns says whether that podcast is still the one being worked on when the answer arrives,
   * so a slow reply for Podcast A is dropped instead of landing in a new Podcast B.
   */
  const trackPodcast = useCallback(() => {
    const started = podcastEpoch.current;
    return () => podcastEpoch.current === started;
  }, []);

  /** Runs a destructive edit and offers to take it back from the toast. */
  const withUndo = useCallback(
    (message, action) => {
      const before = outline;
      dispatch(action);
      toast.show(message, {
        durationMs: 7000,
        action: { label: 'Undo', onClick: () => dispatch({ type: 'RESTORE_OUTLINE', outline: before }) },
      });
    },
    [outline, toast],
  );

  /**
   * Calls the API for one outline, or for 2-3 variations when the form asks for them. Returns
   * { skipped }, or { superseded: true } (nothing written) if the user started or opened another
   * podcast while the model was working.
   */
  const generate = useCallback(async () => {
    const { form } = state;
    const isCurrent = trackPodcast();
    const brief = {
      topic: form.topic.trim(),
      tone: resolvedTone,
      podcastName: form.podcastName.trim() || undefined,
      hostCount: form.hostCount,
      lengthMins: Number(form.lengthMins),
      includeGuests: form.includeGuests,
      guestNames: form.includeGuests ? form.guestNames.trim() : undefined,
      guestBio: form.includeGuests ? form.guestBio.trim() : undefined,
    };

    if (form.variationCount >= 2) {
      const result = await api.post('/api/generate-variations', { ...brief, count: Number(form.variationCount) });
      if (!isCurrent()) return { superseded: true };
      dispatch({ type: 'SET_VARIATIONS', variations: result.variations });
      return { skipped: result.skipped, variations: result.variations.length };
    }
    const result = await api.post('/api/generate-outline', brief);
    if (!isCurrent()) return { superseded: true };
    dispatch({ type: 'SET_OUTLINE', outline: result.outline });
    return { skipped: 0, variations: 0 };
  }, [state, resolvedTone, trackPodcast]);

  const getDeepDive = useCallback(
    (segment) => {
      const entry = state.deepDive[segment.id];
      if (!entry) return null;
      return { data: entry.data, stale: entry.snapshot !== segmentContentKey(segment) };
    },
    [state.deepDive],
  );

  const totalDurationLive = useMemo(() => sumDurations(outline?.segments), [outline]);
  const dirty = useMemo(() => Boolean(outline) && state.savedJson !== JSON.stringify(outline), [outline, state.savedJson]);
  // Work worth confirming before it is set aside: the outline differs from what was saved or loaded.
  // A bundled demo nobody has edited is not: it can be opened again from the brief at any time.
  const hasUnsavedChanges = useMemo(() => {
    if (!dirty) return false;
    const demo = state.demoId ? getDemo(state.demoId) : null;
    return !(demo && JSON.stringify(demo.outline) === JSON.stringify(outline));
  }, [dirty, outline, state.demoId]);

  const actions = useMemo(
    () => ({
      setFormField: (field, value) => send('SET_FORM_FIELD', { field, value }),
      loadDemo: (id) => send('LOAD_DEMO', { id }),
      loadProject: (project) => send('LOAD_PROJECT', { project }),
      setActiveProject: (id, shareToken) => send('SET_ACTIVE_PROJECT', { id, shareToken }),
      setShareToken: (token) => send('SET_SHARE_TOKEN', { token }),
      setCommentsEnabled: (enabled) => send('SET_COMMENTS_ENABLED', { enabled }),
      newPodcast: () => send('NEW_PODCAST'),
      markSaved: (savedAt = new Date().toISOString()) => send('MARK_SAVED', { savedAt }),

      updateOutlineField: (field, value) => send('UPDATE_OUTLINE_FIELD', { field, value }),
      updateSegment: (id, patch) => send('UPDATE_SEGMENT', { id, patch }),
      reorderSegments: (fromId, toId) => send('REORDER_SEGMENTS', { fromId, toId }),
      updateTalkingPoint: (segmentId, index, value) => send('UPDATE_TALKING_POINT', { segmentId, index, value }),
      addTalkingPoint: (segmentId) => send('ADD_TALKING_POINT', { segmentId }),

      updateGuestQuestion: (index, value) => send('UPDATE_GUEST_QUESTION', { index, value }),
      addGuestQuestion: () => send('ADD_GUEST_QUESTION'),
      setGuestQuestions: (questions) => send('SET_GUEST_QUESTIONS', { questions }),

      setDeepDive: (segmentId, snapshot, data) => send('SET_DEEP_DIVE', { segmentId, snapshot, data }),

      pinSource: (segmentId, source) => send('PIN_SOURCE', { segmentId, source }),

      setIntroOutro: (data) => send('SET_INTRO_OUTRO', { data }),
      updateIntroOutro: (patch) => send('UPDATE_INTRO_OUTRO', { patch }),
      updateHook: (index, text) => send('UPDATE_HOOK', { index, text }),
      updateOutroOption: (index, text) => send('UPDATE_OUTRO_OPTION', { index, text }),

      addLocalComment: (comment) => send('ADD_LOCAL_COMMENT', { comment }),
      resolveLocalComment: (id, resolved) => send('RESOLVE_LOCAL_COMMENT', { id, resolved }),
      deleteLocalComment: (id) => send('DELETE_LOCAL_COMMENT', { id }),

      reset: () => send('RESET'),
    }),
    [send],
  );

  // Anything that removes or overwrites content goes through withUndo, so the toast can take it back.
  const undoable = useMemo(
    () => ({
      withUndo,
      chooseVariation: (index, approach) => withUndo(`“${approach}” is now your working outline.`, { type: 'USE_VARIATION', index }),
      blendSegment: (variationIndex, segmentId, mode, targetId, approach) =>
        withUndo(mode === 'add' ? `Added a segment from “${approach}”.` : `Replaced a segment with one from “${approach}”.`, {
          type: 'BLEND_SEGMENT',
          variationIndex,
          segmentId,
          mode,
          targetId,
        }),
      discardVariations: () => withUndo('Alternative structures discarded.', { type: 'CLEAR_VARIATIONS' }),
      removeSegment: (segment) => withUndo(`Removed “${segment.title}”.`, { type: 'REMOVE_SEGMENT', id: segment.id }),
      removeTalkingPoint: (segmentId, index) => withUndo('Removed a talking point.', { type: 'REMOVE_TALKING_POINT', segmentId, index }),
      removeGuestQuestion: (index) => withUndo('Removed a guest question.', { type: 'REMOVE_GUEST_QUESTION', index }),
      unpinSource: (segmentId, source) => withUndo('Unpinned a source.', { type: 'UNPIN_SOURCE', segmentId, url: source.url }),
    }),
    [withUndo],
  );

  return {
    form: state.form,
    resolvedTone,
    outline,
    activeProjectId: state.activeProjectId,
    shareToken: state.shareToken,
    commentsEnabled: state.commentsEnabled,
    savedAt: state.savedAt,
    demoId: state.demoId,
    localComments: state.localComments,
    totalDurationLive,
    dirty,
    hasUnsavedChanges,
    trackPodcast,
    generate,
    getDeepDive,
    ...actions,
    ...undoable,
  };
}
