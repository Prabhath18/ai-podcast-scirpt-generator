import { describe, it, expect } from 'vitest';
import { EMPTY_STATE, composeIntro, loadInitialState, reducer } from '../hooks/workspaceReducer.js';
import { getDemo } from '../services/demoData.js';

const withDemo = () => reducer(EMPTY_STATE, { type: 'LOAD_DEMO', id: 'tech' });
const titles = (state) => state.outline.segments.map((s) => s.title);

describe('LOAD_DEMO', () => {
  it('loads the outline with variations, pinned sources, hooks and sample comments', () => {
    const state = withDemo();
    expect(state.outline.variations).toHaveLength(2);
    expect(state.outline.intro_outro.hooks).toHaveLength(5);
    expect(state.outline.segments.some((s) => s.sources?.length)).toBe(true);
    expect(state.localComments.length).toBeGreaterThan(0);
    expect(state.demoId).toBe('tech');
  });

  it('starts clean: nothing is marked saved and no project is attached', () => {
    const state = withDemo();
    expect(state.activeProjectId).toBeNull();
    expect(state.savedJson).toBeNull();
  });
});

describe('segments', () => {
  it('REORDER_SEGMENTS moves a segment to another segment\'s position', () => {
    const state = withDemo();
    const [first, second] = state.outline.segments;
    const next = reducer(state, { type: 'REORDER_SEGMENTS', fromId: first.id, toId: second.id });
    expect(titles(next).slice(0, 2)).toEqual([second.title, first.title]);
    expect(next.outline.segments).toHaveLength(state.outline.segments.length);
  });

  it('ignores a reorder onto itself or an unknown id', () => {
    const state = withDemo();
    expect(reducer(state, { type: 'REORDER_SEGMENTS', fromId: 1, toId: 1 })).toBe(state);
    expect(reducer(state, { type: 'REORDER_SEGMENTS', fromId: 1, toId: 999 })).toBe(state);
  });

  it('REMOVE_SEGMENT works while there are more than five, and refuses at five', () => {
    const six = withDemo();
    const five = reducer(six, { type: 'REMOVE_SEGMENT', id: 6 });
    expect(five.outline.segments).toHaveLength(5);
    expect(reducer(five, { type: 'REMOVE_SEGMENT', id: 1 })).toBe(five);
  });

  it('RESTORE_OUTLINE puts an earlier outline back (the Undo action)', () => {
    const before = withDemo();
    const removed = reducer(before, { type: 'REMOVE_SEGMENT', id: 6 });
    expect(reducer(removed, { type: 'RESTORE_OUTLINE', outline: before.outline }).outline.segments).toHaveLength(6);
  });

  it('keeps talking points between 3 and 5', () => {
    let state = withDemo();
    const id = 2; // starts with 4 points
    state = reducer(state, { type: 'ADD_TALKING_POINT', segmentId: id });
    expect(state.outline.segments[1].talking_points).toHaveLength(5);
    expect(reducer(state, { type: 'ADD_TALKING_POINT', segmentId: id })).toEqual(state);
    for (let i = 0; i < 5; i++) state = reducer(state, { type: 'REMOVE_TALKING_POINT', segmentId: id, index: 0 });
    expect(state.outline.segments[1].talking_points).toHaveLength(3);
  });
});

describe('variations', () => {
  it('USE_VARIATION swaps in the shape and clears cached Deep Dives, keeping the alternatives', () => {
    let state = withDemo();
    state = reducer(state, { type: 'SET_DEEP_DIVE', segmentId: 1, snapshot: 'x', data: { notes: 'n' } });
    const next = reducer(state, { type: 'USE_VARIATION', index: 0 });
    expect(next.outline.episode_title).toBe(state.outline.variations[0].outline.episode_title);
    expect(next.outline.variations).toHaveLength(2);
    expect(next.deepDive).toEqual({});
  });

  it('BLEND_SEGMENT add appends a segment and keeps the total steady', () => {
    const state = reducer(withDemo(), { type: 'USE_VARIATION', index: 0 }); // 5 segments
    const total = state.outline.segments.reduce((sum, s) => sum + s.duration_mins, 0);
    const next = reducer(state, { type: 'BLEND_SEGMENT', variationIndex: 1, segmentId: 1, mode: 'add' });
    expect(next.outline.segments).toHaveLength(6);
    expect(next.outline.segments.reduce((sum, s) => sum + s.duration_mins, 0)).toBe(total);
  });

  it('BLEND_SEGMENT is a no-op for an unknown variation or segment', () => {
    const state = withDemo();
    expect(reducer(state, { type: 'BLEND_SEGMENT', variationIndex: 9, segmentId: 1, mode: 'add' })).toBe(state);
    expect(reducer(state, { type: 'BLEND_SEGMENT', variationIndex: 0, segmentId: 99, mode: 'add' })).toBe(state);
  });

  it('SET_VARIATIONS makes the first one the working outline and keeps all of them', () => {
    const { outline } = getDemo('tech');
    const next = reducer(EMPTY_STATE, { type: 'SET_VARIATIONS', variations: outline.variations });
    expect(next.outline.episode_title).toBe(outline.variations[0].outline.episode_title);
    expect(next.outline.variations).toHaveLength(2);
  });

  it('CLEAR_VARIATIONS drops the alternatives', () => {
    expect(reducer(withDemo(), { type: 'CLEAR_VARIATIONS' }).outline.variations).toBeUndefined();
  });
});

describe('pinned sources', () => {
  const source = { type: 'wikipedia', title: 'Jazz', url: 'https://en.wikipedia.org/wiki/Jazz', summary: 'A genre.' };

  it('pins a source once and unpins it by url', () => {
    let state = reducer(withDemo(), { type: 'PIN_SOURCE', segmentId: 2, source });
    state = reducer(state, { type: 'PIN_SOURCE', segmentId: 2, source });
    expect(state.outline.segments[1].sources).toEqual([source]);
    state = reducer(state, { type: 'UNPIN_SOURCE', segmentId: 2, url: source.url });
    expect(state.outline.segments[1].sources).toEqual([]);
  });

  it('caps pinned sources at ten per segment', () => {
    let state = withDemo();
    for (let i = 0; i < 12; i++) state = reducer(state, { type: 'PIN_SOURCE', segmentId: 2, source: { ...source, url: `https://example.com/${i}` } });
    expect(state.outline.segments[1].sources).toHaveLength(10);
  });
});

describe('intro and outro', () => {
  it('USE_HOOK puts the hook first, then the intro script', () => {
    const state = withDemo();
    const { hooks, intro_script } = state.outline.intro_outro;
    const next = reducer(state, { type: 'USE_HOOK', index: 1 });
    expect(next.outline.intro).toBe(`${hooks[1].text}\n\n${intro_script}`);
  });

  it('USE_OUTRO replaces the outro with the chosen option', () => {
    const state = withDemo();
    expect(reducer(state, { type: 'USE_OUTRO', index: 2 }).outline.outro).toBe(state.outline.intro_outro.outros[2]);
  });

  it('editing a hook does not change the intro until it is used', () => {
    const state = withDemo();
    const next = reducer(state, { type: 'UPDATE_HOOK', index: 0, text: 'A new hook.' });
    expect(next.outline.intro_outro.hooks[0].text).toBe('A new hook.');
    expect(next.outline.intro).toBe(state.outline.intro);
  });

  it('composeIntro skips empty parts', () => {
    expect(composeIntro('  Hook. ', '')).toBe('Hook.');
    expect(composeIntro('', 'Script.')).toBe('Script.');
  });
});

describe('local comments (demo)', () => {
  it('adds, resolves and deletes a comment', () => {
    let state = withDemo();
    const count = state.localComments.length;
    state = reducer(state, { type: 'ADD_LOCAL_COMMENT', comment: { segmentId: 1, body: 'Hi', createdAt: new Date().toISOString(), author: { name: 'me' } } });
    expect(state.localComments).toHaveLength(count + 1);
    const { id } = state.localComments.at(-1);
    state = reducer(state, { type: 'RESOLVE_LOCAL_COMMENT', id, resolved: true });
    expect(state.localComments.at(-1).resolved).toBe(true);
    state = reducer(state, { type: 'DELETE_LOCAL_COMMENT', id });
    expect(state.localComments).toHaveLength(count);
  });
});

describe('loadInitialState (drafts saved before newer fields existed)', () => {
  const storage = (value) => ({ getItem: () => value });

  it('fills in defaults for a draft saved by an older version', () => {
    const old = JSON.stringify({ form: { topic: 'Old topic' }, outline: { episode_title: 'Old', segments: [] }, deepDive: {} });
    const state = loadInitialState(storage(old));
    expect(state.form.topic).toBe('Old topic');
    expect(state.form.variationCount).toBe(0);
    expect(state.localComments).toEqual([]);
    expect(state.savedJson).toBeNull();
    expect(state.commentsEnabled).toBe(true);
  });

  it('falls back to a clean state on corrupt data', () => {
    expect(loadInitialState(storage('{not json'))).toBe(EMPTY_STATE);
    expect(loadInitialState(storage(null))).toBe(EMPTY_STATE);
  });
});

describe('dirty tracking inputs', () => {
  it('MARK_SAVED records the current outline so later edits can be detected', () => {
    const state = reducer(withDemo(), { type: 'MARK_SAVED', savedAt: '2026-01-01 00:00:00' });
    expect(state.savedJson).toBe(JSON.stringify(state.outline));
    const edited = reducer(state, { type: 'UPDATE_OUTLINE_FIELD', field: 'episode_title', value: 'Changed' });
    expect(edited.savedJson).not.toBe(JSON.stringify(edited.outline));
  });
});
