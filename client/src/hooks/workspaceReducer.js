// All state changes for the workspace, as one pure reducer so they can be
// unit tested without React. The state is what gets persisted to localStorage.
import { getDemo } from '../services/demoData.js';
import { WORKSPACE_KEY } from '../services/session.js';
import { OUTLINE_LIMITS } from './constants.js';
import { applyVariation, blendSegment } from '../utils/blend.js';

export const STORAGE_KEY = WORKSPACE_KEY;

export const DEFAULT_FORM = {
  topic: '',
  tone: 'Conversational',
  customTone: '',
  podcastName: '',
  hostCount: 'solo',
  lengthMins: 30,
  includeGuests: false,
  guestNames: '',
  guestBio: '',
  variationCount: 0, // 0 = a single outline; 2 or 3 = generate that many structures to compare
};

export const EMPTY_STATE = {
  form: DEFAULT_FORM,
  outline: null,
  deepDive: {},
  activeProjectId: null,
  shareToken: null,
  commentsEnabled: true,
  savedJson: null, // the outline as last saved or loaded; compared to detect unsaved edits
  savedAt: null,
  demoId: null, // set while a bundled demo is loaded, so its sample comments can be shown
  localComments: [],
};

/** Reads saved state, tolerating drafts written before newer fields existed. */
export function loadInitialState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw);
    return {
      ...EMPTY_STATE,
      ...parsed,
      form: { ...DEFAULT_FORM, ...parsed.form },
      deepDive: parsed.deepDive ?? {},
      localComments: parsed.localComments ?? [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

const isSegmentCountValid = (segments) =>
  segments.length >= OUTLINE_LIMITS.MIN_SEGMENTS && segments.length <= OUTLINE_LIMITS.MAX_SEGMENTS;

function withOutline(state, change) {
  if (!state.outline) return state;
  return { ...state, outline: { ...state.outline, ...change(state.outline) } };
}

function mapSegment(state, segmentId, change) {
  return withOutline(state, (outline) => ({
    segments: outline.segments.map((s) => (s.id === segmentId ? { ...s, ...change(s) } : s)),
  }));
}

function fromOutline(state, outline, extra = {}) {
  return {
    ...state,
    outline,
    deepDive: {},
    activeProjectId: null,
    shareToken: null,
    savedJson: null,
    savedAt: null,
    demoId: null,
    localComments: [],
    ...extra,
  };
}

function formFromOutline(state, outline) {
  return { ...state.form, topic: outline.episode_title, tone: outline.tone, lengthMins: outline.total_duration_mins };
}

/** A chosen hook opens the intro; the intro script (which never repeats the hook) follows it. */
export function composeIntro(hookText, introScript) {
  return [hookText, introScript].map((part) => (part || '').trim()).filter(Boolean).join('\n\n');
}

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_FORM_FIELD':
      return { ...state, form: { ...state.form, [action.field]: action.value } };

    case 'SET_OUTLINE':
      return fromOutline(state, action.outline);

    case 'LOAD_DEMO': {
      const demo = getDemo(action.id);
      return fromOutline(state, demo.outline, {
        demoId: demo.id,
        localComments: demo.comments,
        form: formFromOutline(state, demo.outline),
      });
    }

    case 'LOAD_PROJECT':
      return fromOutline(state, action.project.outline, {
        activeProjectId: action.project.id,
        shareToken: action.project.shareToken ?? null,
        commentsEnabled: action.project.commentsEnabled ?? true,
        savedJson: JSON.stringify(action.project.outline),
        savedAt: action.project.updatedAt ?? null,
        form: formFromOutline(state, action.project.outline),
      });

    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectId: action.id, shareToken: action.shareToken ?? state.shareToken };

    case 'SET_SHARE_TOKEN':
      return { ...state, shareToken: action.token };

    case 'SET_COMMENTS_ENABLED':
      return { ...state, commentsEnabled: action.enabled };

    case 'MARK_SAVED':
      return { ...state, savedJson: JSON.stringify(state.outline), savedAt: action.savedAt };

    /** Puts back an earlier outline (the Undo action on delete toasts). */
    case 'RESTORE_OUTLINE':
      return { ...state, outline: action.outline };

    case 'UPDATE_OUTLINE_FIELD':
      return withOutline(state, () => ({ [action.field]: action.value }));

    case 'UPDATE_SEGMENT':
      return mapSegment(state, action.id, () => action.patch);

    case 'REORDER_SEGMENTS': {
      if (!state.outline) return state;
      const segments = [...state.outline.segments];
      const from = segments.findIndex((s) => s.id === action.fromId);
      const to = segments.findIndex((s) => s.id === action.toId);
      if (from < 0 || to < 0 || from === to) return state;
      segments.splice(to, 0, segments.splice(from, 1)[0]);
      return withOutline(state, () => ({ segments }));
    }

    case 'REMOVE_SEGMENT': {
      if (!state.outline) return state;
      const segments = state.outline.segments.filter((s) => s.id !== action.id);
      if (!isSegmentCountValid(segments)) return state;
      return withOutline(state, () => ({ segments }));
    }

    case 'UPDATE_TALKING_POINT':
      return mapSegment(state, action.segmentId, (s) => ({
        talking_points: s.talking_points.map((p, i) => (i === action.index ? action.value : p)),
      }));

    case 'ADD_TALKING_POINT':
      return mapSegment(state, action.segmentId, (s) =>
        s.talking_points.length >= OUTLINE_LIMITS.MAX_TALKING_POINTS ? {} : { talking_points: [...s.talking_points, ''] },
      );

    case 'REMOVE_TALKING_POINT':
      return mapSegment(state, action.segmentId, (s) =>
        s.talking_points.length <= OUTLINE_LIMITS.MIN_TALKING_POINTS
          ? {}
          : { talking_points: s.talking_points.filter((_, i) => i !== action.index) },
      );

    case 'UPDATE_GUEST_QUESTION':
      return withOutline(state, (o) => ({
        guest_questions: o.guest_questions.map((q, i) => (i === action.index ? action.value : q)),
      }));

    case 'ADD_GUEST_QUESTION':
      return withOutline(state, (o) => ({ guest_questions: [...o.guest_questions, ''] }));

    case 'REMOVE_GUEST_QUESTION':
      return withOutline(state, (o) => ({ guest_questions: o.guest_questions.filter((_, i) => i !== action.index) }));

    case 'SET_GUEST_QUESTIONS':
      return withOutline(state, () => ({ guest_questions: action.questions }));

    case 'SET_DEEP_DIVE':
      return {
        ...state,
        deepDive: { ...state.deepDive, [action.segmentId]: { snapshot: action.snapshot, data: action.data } },
      };

    // --- Variations -------------------------------------------------------

    /** A fresh set of variations: the first becomes the working outline and all are kept for comparing. */
    case 'SET_VARIATIONS': {
      const [first] = action.variations;
      return fromOutline(state, { ...first.outline, variations: action.variations });
    }

    case 'USE_VARIATION': {
      const variation = state.outline?.variations?.[action.index];
      if (!variation) return state;
      return { ...withOutline(state, (o) => applyVariation(o, variation)), deepDive: {} };
    }

    case 'BLEND_SEGMENT': {
      const variation = state.outline?.variations?.[action.variationIndex];
      const incoming = variation?.outline.segments.find((s) => s.id === action.segmentId);
      if (!incoming) return state;
      const segments = blendSegment(state.outline.segments, incoming, { mode: action.mode, targetId: action.targetId });
      return segments ? withOutline(state, () => ({ segments })) : state;
    }

    case 'CLEAR_VARIATIONS':
      return withOutline(state, () => ({ variations: undefined }));

    // --- Pinned sources ---------------------------------------------------

    case 'PIN_SOURCE':
      return mapSegment(state, action.segmentId, (s) => {
        const current = s.sources || [];
        if (current.length >= OUTLINE_LIMITS.MAX_SOURCES_PER_SEGMENT || current.some((x) => x.url === action.source.url)) return {};
        return { sources: [...current, action.source] };
      });

    case 'UNPIN_SOURCE':
      return mapSegment(state, action.segmentId, (s) => ({
        sources: (s.sources || []).filter((x) => x.url !== action.url),
      }));

    // --- Intro and outro --------------------------------------------------

    case 'SET_INTRO_OUTRO':
      return withOutline(state, () => ({ intro_outro: action.data }));

    case 'UPDATE_INTRO_OUTRO':
      return withOutline(state, (o) => ({ intro_outro: { ...o.intro_outro, ...action.patch } }));

    case 'UPDATE_HOOK':
      return withOutline(state, (o) => ({
        intro_outro: { ...o.intro_outro, hooks: o.intro_outro.hooks.map((h, i) => (i === action.index ? { ...h, text: action.text } : h)) },
      }));

    case 'UPDATE_OUTRO_OPTION':
      return withOutline(state, (o) => ({
        intro_outro: { ...o.intro_outro, outros: o.intro_outro.outros.map((t, i) => (i === action.index ? action.text : t)) },
      }));

    case 'USE_HOOK':
      return withOutline(state, (o) => ({ intro: composeIntro(o.intro_outro.hooks[action.index]?.text, o.intro_outro.intro_script) }));

    case 'USE_OUTRO':
      return withOutline(state, (o) => ({ outro: o.intro_outro.outros[action.index] ?? o.outro }));

    // --- Comments kept in the browser (demo mode only) ---------------------

    case 'ADD_LOCAL_COMMENT':
      return { ...state, localComments: [...state.localComments, { id: `local-${Date.now()}-${state.localComments.length}`, resolved: false, isMine: true, ...action.comment }] };

    case 'RESOLVE_LOCAL_COMMENT':
      return { ...state, localComments: state.localComments.map((c) => (c.id === action.id ? { ...c, resolved: action.resolved } : c)) };

    case 'DELETE_LOCAL_COMMENT':
      return { ...state, localComments: state.localComments.filter((c) => c.id !== action.id) };

    case 'RESET':
      return EMPTY_STATE;

    default:
      return state;
  }
}
