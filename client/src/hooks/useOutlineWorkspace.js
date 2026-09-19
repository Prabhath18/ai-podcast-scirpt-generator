import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { api } from '../services/api.js';
import { getDemoOutline } from '../services/demoData.js';
import { segmentContentKey } from '../utils/segmentSnapshot.js';
import { OUTLINE_LIMITS } from './constants.js';

const STORAGE_KEY = 'podcast-workspace-v1';

const DEFAULT_FORM = {
  topic: '',
  tone: 'Conversational',
  customTone: '',
  podcastName: '',
  hostCount: 'solo',
  lengthMins: 30,
  includeGuests: false,
  guestNames: '',
  guestBio: '',
};

function loadInitialState() {
  const fallback = { form: DEFAULT_FORM, outline: null, deepDive: {}, activeProjectId: null, shareToken: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      form: { ...DEFAULT_FORM, ...parsed.form },
      outline: parsed.outline ?? null,
      deepDive: parsed.deepDive ?? {},
      activeProjectId: parsed.activeProjectId ?? null,
      shareToken: parsed.shareToken ?? null,
    };
  } catch {
    return fallback;
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FORM_FIELD':
      return { ...state, form: { ...state.form, [action.field]: action.value } };

    case 'SET_OUTLINE':
      return { ...state, outline: action.outline, deepDive: {}, activeProjectId: null, shareToken: null };

    case 'LOAD_DEMO': {
      const demo = getDemoOutline(action.id);
      return {
        ...state,
        outline: demo.outline,
        deepDive: {},
        activeProjectId: null,
        shareToken: null,
        form: {
          ...state.form,
          topic: demo.outline.episode_title,
          tone: demo.outline.tone,
          lengthMins: demo.outline.total_duration_mins,
        },
      };
    }

    case 'LOAD_PROJECT':
      return {
        ...state,
        outline: action.project.outline,
        deepDive: {},
        activeProjectId: action.project.id,
        shareToken: action.project.shareToken ?? null,
        form: {
          ...state.form,
          topic: action.project.outline.episode_title,
          tone: action.project.outline.tone,
          lengthMins: action.project.outline.total_duration_mins,
        },
      };

    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectId: action.id, shareToken: action.shareToken ?? state.shareToken };

    case 'SET_SHARE_TOKEN':
      return { ...state, shareToken: action.token };

    case 'UPDATE_OUTLINE_FIELD':
      if (!state.outline) return state;
      return { ...state, outline: { ...state.outline, [action.field]: action.value } };

    case 'UPDATE_SEGMENT': {
      if (!state.outline) return state;
      const segments = state.outline.segments.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s));
      return { ...state, outline: { ...state.outline, segments } };
    }

    case 'UPDATE_TALKING_POINT': {
      if (!state.outline) return state;
      const segments = state.outline.segments.map((s) => {
        if (s.id !== action.segmentId) return s;
        const talking_points = s.talking_points.map((p, i) => (i === action.index ? action.value : p));
        return { ...s, talking_points };
      });
      return { ...state, outline: { ...state.outline, segments } };
    }

    case 'ADD_TALKING_POINT': {
      if (!state.outline) return state;
      const segments = state.outline.segments.map((s) => {
        if (s.id !== action.segmentId) return s;
        if (s.talking_points.length >= OUTLINE_LIMITS.MAX_TALKING_POINTS) return s;
        return { ...s, talking_points: [...s.talking_points, ''] };
      });
      return { ...state, outline: { ...state.outline, segments } };
    }

    case 'REMOVE_TALKING_POINT': {
      if (!state.outline) return state;
      const segments = state.outline.segments.map((s) => {
        if (s.id !== action.segmentId) return s;
        if (s.talking_points.length <= OUTLINE_LIMITS.MIN_TALKING_POINTS) return s;
        return { ...s, talking_points: s.talking_points.filter((_, i) => i !== action.index) };
      });
      return { ...state, outline: { ...state.outline, segments } };
    }

    case 'UPDATE_GUEST_QUESTION': {
      if (!state.outline) return state;
      const guest_questions = state.outline.guest_questions.map((q, i) => (i === action.index ? action.value : q));
      return { ...state, outline: { ...state.outline, guest_questions } };
    }

    case 'ADD_GUEST_QUESTION':
      if (!state.outline) return state;
      return { ...state, outline: { ...state.outline, guest_questions: [...state.outline.guest_questions, ''] } };

    case 'REMOVE_GUEST_QUESTION': {
      if (!state.outline) return state;
      const guest_questions = state.outline.guest_questions.filter((_, i) => i !== action.index);
      return { ...state, outline: { ...state.outline, guest_questions } };
    }

    case 'SET_GUEST_QUESTIONS':
      if (!state.outline) return state;
      return { ...state, outline: { ...state.outline, guest_questions: action.questions } };

    case 'SET_DEEP_DIVE':
      return {
        ...state,
        deepDive: {
          ...state.deepDive,
          [action.segmentId]: { snapshot: action.snapshot, data: action.data },
        },
      };

    case 'RESET':
      return { form: DEFAULT_FORM, outline: null, deepDive: {}, activeProjectId: null, shareToken: null };

    default:
      return state;
  }
}

export function useOutlineWorkspace() {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable -- editing still works in-memory */
    }
  }, [state]);

  const resolvedTone = state.form.tone === 'Other' ? state.form.customTone.trim() : state.form.tone;

  const setFormField = useCallback((field, value) => dispatch({ type: 'SET_FORM_FIELD', field, value }), []);

  const generate = useCallback(async () => {
    const { form } = state;
    const outline = await api.post('/api/generate-outline', {
      topic: form.topic.trim(),
      tone: resolvedTone,
      podcastName: form.podcastName.trim() || undefined,
      hostCount: form.hostCount,
      lengthMins: Number(form.lengthMins),
      includeGuests: form.includeGuests,
      guestNames: form.includeGuests ? form.guestNames.trim() : undefined,
      guestBio: form.includeGuests ? form.guestBio.trim() : undefined,
    });
    dispatch({ type: 'SET_OUTLINE', outline: outline.outline });
    return outline.outline;
  }, [state, resolvedTone]);

  const loadDemo = useCallback((id) => dispatch({ type: 'LOAD_DEMO', id }), []);
  const loadProject = useCallback((project) => dispatch({ type: 'LOAD_PROJECT', project }), []);
  const setActiveProject = useCallback((id, shareToken) => dispatch({ type: 'SET_ACTIVE_PROJECT', id, shareToken }), []);
  const setShareToken = useCallback((token) => dispatch({ type: 'SET_SHARE_TOKEN', token }), []);

  const updateOutlineField = useCallback((field, value) => dispatch({ type: 'UPDATE_OUTLINE_FIELD', field, value }), []);
  const updateSegment = useCallback((id, patch) => dispatch({ type: 'UPDATE_SEGMENT', id, patch }), []);
  const updateTalkingPoint = useCallback(
    (segmentId, index, value) => dispatch({ type: 'UPDATE_TALKING_POINT', segmentId, index, value }),
    [],
  );
  const addTalkingPoint = useCallback((segmentId) => dispatch({ type: 'ADD_TALKING_POINT', segmentId }), []);
  const removeTalkingPoint = useCallback(
    (segmentId, index) => dispatch({ type: 'REMOVE_TALKING_POINT', segmentId, index }),
    [],
  );

  const updateGuestQuestion = useCallback((index, value) => dispatch({ type: 'UPDATE_GUEST_QUESTION', index, value }), []);
  const addGuestQuestion = useCallback(() => dispatch({ type: 'ADD_GUEST_QUESTION' }), []);
  const removeGuestQuestion = useCallback((index) => dispatch({ type: 'REMOVE_GUEST_QUESTION', index }), []);
  const setGuestQuestions = useCallback((questions) => dispatch({ type: 'SET_GUEST_QUESTIONS', questions }), []);

  const setDeepDive = useCallback((segmentId, snapshot, data) => dispatch({ type: 'SET_DEEP_DIVE', segmentId, snapshot, data }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  /** Returns { data, stale } | null for a segment's cached Deep Dive. */
  const getDeepDive = useCallback(
    (segment) => {
      const entry = state.deepDive[segment.id];
      if (!entry) return null;
      return { data: entry.data, stale: entry.snapshot !== segmentContentKey(segment) };
    },
    [state.deepDive],
  );

  const totalDurationLive = useMemo(
    () => (state.outline?.segments || []).reduce((sum, s) => sum + (Number(s.duration_mins) || 0), 0),
    [state.outline],
  );

  return {
    form: state.form,
    resolvedTone,
    outline: state.outline,
    activeProjectId: state.activeProjectId,
    shareToken: state.shareToken,
    totalDurationLive,
    setFormField,
    generate,
    loadDemo,
    loadProject,
    setActiveProject,
    setShareToken,
    updateOutlineField,
    updateSegment,
    updateTalkingPoint,
    addTalkingPoint,
    removeTalkingPoint,
    updateGuestQuestion,
    addGuestQuestion,
    removeGuestQuestion,
    setGuestQuestions,
    getDeepDive,
    setDeepDive,
    reset,
  };
}
