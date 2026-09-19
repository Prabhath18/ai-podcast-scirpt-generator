// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { OUTLINE, jsonReply, mockApi, renderAt, resetBrowser, respondWith } from './helpers.jsx';
import { EMPTY_STATE, STORAGE_KEY, reducer } from '../hooks/workspaceReducer.js';
import { getDemo } from '../services/demoData.js';

beforeEach(resetBrowser);
afterEach(() => {
  vi.useRealTimers();
  resetBrowser();
});

const OUTLINE_B = { ...OUTLINE, episode_title: 'Podcast B Title', segments: OUTLINE.segments.map((s) => ({ ...s, title: `B ${s.title}` })) };
const PROJECT_A = { id: 7, title: OUTLINE.episode_title, updatedAt: '2026-01-01 10:00:00', shareToken: null, outline: OUTLINE };

const newPodcastButton = () => screen.getByRole('button', { name: /New Podcast/ });
const topic = () => screen.getByLabelText(/Topic/);

/** Fills the brief the way a user would (topic, tone, guest) and generates. */
async function generate({ topicText = 'Future of AI', guest = false } = {}) {
  fireEvent.change(await screen.findByLabelText(/Topic/), { target: { value: topicText } });
  if (guest) {
    fireEvent.click(screen.getByLabelText('This episode has a guest'));
    fireEvent.change(screen.getByLabelText(/Guest name/), { target: { value: 'John' } });
  }
  fireEvent.click(screen.getByRole('button', { name: /Generate outline/ }));
}

async function editFirstSegmentTitle(text) {
  fireEvent.click((await screen.findAllByRole('button', { name: /^Edit title of/ }))[0]);
  const input = await screen.findByLabelText(/^title of/);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
  await screen.findByText(text);
}

const confirmDialog = () => screen.queryByRole('dialog', { name: 'Start a new podcast?' });

/** A signed-in fake server that can save the first project. */
function signedInApi(extra = {}) {
  return mockApi({
    signedIn: true,
    projects: [PROJECT_A],
    handlers: {
      'POST /api/projects': () => jsonReply(201, { project: { id: 7, shareToken: null, updatedAt: '2026-01-01 10:00:00' } }),
      ...extra,
    },
  });
}

async function saveCurrent() {
  fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
  await screen.findAllByText(/^Saved/);
}

describe('+ New Podcast: reset', () => {
  it('shows the button in the header of the workspace', async () => {
    mockApi();
    renderAt('/app');
    expect(await screen.findByRole('button', { name: /New Podcast/ })).toBeTruthy();
  });

  it('Test 1: after generating, asks first (the outline is unsaved), then leaves a blank form with no trace of Podcast A', async () => {
    mockApi();
    renderAt('/app');
    await generate({ guest: true });
    await screen.findAllByText(OUTLINE.episode_title);

    fireEvent.click(newPodcastButton());
    const dialog = await screen.findByRole('dialog', { name: 'Start a new podcast?' });
    expect(within(dialog).getByText('You have unsaved changes in this podcast. If you start a new podcast, those changes may be lost.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard & Create New' }));

    await waitFor(() => expect(confirmDialog()).toBeNull());
    expect(screen.getByRole('heading', { name: 'Start with the brief' })).toBeTruthy();
    expect(topic().value).toBe('');
    expect(screen.getByRole('radio', { name: 'Conversational' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('This episode has a guest').checked).toBe(false);
    expect(screen.queryByLabelText(/Guest name/)).toBeNull();
    expect(screen.getByLabelText(/Length/).value).toBe('30');
    expect(screen.queryByText(OUTLINE.episode_title)).toBeNull();
    expect(screen.queryByRole('tab', { name: /Variations/ })).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull(); // a refresh now shows the blank form too
    await waitFor(() => expect(document.activeElement).toBe(topic())); // cursor is ready for the new topic
  });

  it('a second podcast can then be generated from the blank form', async () => {
    mockApi({ generate: ['ok', respondWith(OUTLINE_B)] });
    renderAt('/app');
    await generate();
    await screen.findAllByText(OUTLINE.episode_title);
    fireEvent.click(newPodcastButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Discard & Create New' }));

    await generate({ topicText: 'Something else' });

    await screen.findAllByText('Podcast B Title');
    expect(screen.queryByText(OUTLINE.episode_title)).toBeNull();
  });
});

describe('+ New Podcast: unsaved changes', () => {
  it('Test 3: Cancel keeps the podcast (and its edit); Discard & Create New clears it', async () => {
    signedInApi();
    renderAt('/app');
    await generate();
    await screen.findAllByText(OUTLINE.episode_title);
    await saveCurrent();
    await editFirstSegmentTitle('An edited segment title');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();

    fireEvent.click(newPodcastButton());
    const dialog = await screen.findByRole('dialog', { name: 'Start a new podcast?' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' })); // the safe choice has focus
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(confirmDialog()).toBeNull());
    expect(screen.getByText('An edited segment title')).toBeTruthy();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();

    fireEvent.click(newPodcastButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Discard & Create New' }));

    await waitFor(() => expect(topic().value).toBe(''));
    expect(screen.queryByText('An edited segment title')).toBeNull();
  });

  it('Escape also cancels', async () => {
    mockApi();
    renderAt('/app');
    await generate();
    await screen.findAllByText(OUTLINE.episode_title);
    fireEvent.click(newPodcastButton());
    await screen.findByRole('dialog', { name: 'Start a new podcast?' });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(confirmDialog()).toBeNull());
    expect(screen.getAllByText(OUTLINE.episode_title).length).toBeGreaterThan(0);
  });

  it('Test 4: a saved podcast with no changes starts a new one without asking', async () => {
    signedInApi();
    renderAt('/app');
    await generate();
    await screen.findAllByText(OUTLINE.episode_title);
    await saveCurrent();

    fireEvent.click(newPodcastButton());

    await waitFor(() => expect(topic().value).toBe(''));
    expect(confirmDialog()).toBeNull();
  });

  it('edits that were saved afterwards no longer count as unsaved', async () => {
    signedInApi();
    renderAt('/app');
    await generate();
    await screen.findAllByText(OUTLINE.episode_title);
    await editFirstSegmentTitle('Edited then saved');
    await saveCurrent();
    fireEvent.click(newPodcastButton());
    await waitFor(() => expect(topic().value).toBe(''));
    expect(confirmDialog()).toBeNull();
  });

  it('an edited bundled demo asks before it is set aside (an unedited one does not: see the leak test)', async () => {
    mockApi();
    renderAt('/app');
    fireEvent.click((await screen.findAllByRole('button', { name: /Tech|AI Coding|coding/i }))[0]);
    await screen.findAllByText(/How AI Coding Assistants Are Rewiring Software Careers/);

    await editFirstSegmentTitle('Changed in the demo');
    fireEvent.click(newPodcastButton());
    expect(await screen.findByRole('dialog', { name: 'Start a new podcast?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(confirmDialog()).toBeNull());
  });

  it('with nothing on screen but a half-filled brief, it just clears the brief', async () => {
    mockApi();
    renderAt('/app');
    fireEvent.change(await screen.findByLabelText(/Topic/), { target: { value: 'half typed' } });

    fireEvent.click(newPodcastButton());

    await waitFor(() => expect(topic().value).toBe(''));
    expect(confirmDialog()).toBeNull();
  });
});

describe('+ New Podcast: saved projects', () => {
  it('Test 2: the saved podcast survives, is never deleted or overwritten, and reopens unchanged', async () => {
    const calls = signedInApi();
    renderAt('/app');
    await generate();
    await screen.findAllByText(OUTLINE.episode_title);
    await saveCurrent();

    fireEvent.click(newPodcastButton()); // saved and unchanged: no confirmation
    await waitFor(() => expect(topic().value).toBe(''));

    // A new project is not created by starting a new podcast, and nothing is deleted or overwritten.
    expect(calls.filter((c) => c.startsWith('DELETE'))).toEqual([]);
    expect(calls.filter((c) => c.startsWith('PUT'))).toEqual([]);
    expect(calls.filter((c) => c === 'POST /api/projects')).toHaveLength(1);

    // The header's "My episodes" still lists Podcast A, and opening it (the workspace is blank, so no prompt) restores it.
    fireEvent.click(screen.getByRole('button', { name: 'My episodes' }));
    const list = await screen.findByRole('dialog', { name: 'My episodes' });
    fireEvent.click(await within(list).findByText(OUTLINE.episode_title));

    await screen.findAllByText(OUTLINE.episode_title);
    expect(screen.getAllByText('Segment 1 title').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Saved/).length).toBeGreaterThan(0);
  });

  it('after generating Podcast B, opening A asks first, and Discard & Open brings A back unchanged', async () => {
    signedInApi();
    mockApi({
      signedIn: true,
      projects: [PROJECT_A],
      generate: ['ok', respondWith(OUTLINE_B)],
      handlers: { 'POST /api/projects': () => jsonReply(201, { project: { id: 7, shareToken: null, updatedAt: '2026-01-01 10:00:00' } }) },
    });
    renderAt('/app');
    await generate();
    await screen.findAllByText(OUTLINE.episode_title);
    await saveCurrent();
    fireEvent.click(newPodcastButton());
    await waitFor(() => expect(topic().value).toBe(''));
    await generate({ topicText: 'B topic' });
    await screen.findAllByText('Podcast B Title');

    fireEvent.click(screen.getByRole('button', { name: 'My episodes' }));
    const list = await screen.findByRole('dialog', { name: 'My episodes' });
    fireEvent.click(await within(list).findByText(OUTLINE.episode_title));

    const dialog = await screen.findByRole('dialog', { name: 'Open another episode?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    // Cancel goes back to the list, and B is still on screen behind it.
    await screen.findByRole('dialog', { name: 'My episodes' });
    expect(screen.getAllByText('Podcast B Title').length).toBeGreaterThan(0);

    fireEvent.click(await within(screen.getByRole('dialog', { name: 'My episodes' })).findByText(OUTLINE.episode_title));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard & Open' }));

    await waitFor(() => expect(screen.getAllByText('Segment 1 title').length).toBeGreaterThan(0));
    expect(screen.queryByText('Podcast B Title')).toBeNull();
    expect(screen.queryByText('B Segment 1 title')).toBeNull();
  });

  it('the My episodes dialog has its own New Podcast button, and using it leaves the list untouched', async () => {
    const calls = signedInApi();
    renderAt('/app');
    fireEvent.click(await screen.findByRole('button', { name: 'My episodes' }));
    const list = await screen.findByRole('dialog', { name: 'My episodes' });
    await within(list).findByText(OUTLINE.episode_title);

    fireEvent.click(within(list).getByRole('button', { name: /New Podcast/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(topic()));
    expect(calls.filter((c) => c.startsWith('DELETE') || c.startsWith('PUT'))).toEqual([]);
  });

  it('from My episodes with unsaved work: asks, and Cancel returns to the list', async () => {
    signedInApi();
    renderAt('/app');
    await generate();
    await screen.findAllByText(OUTLINE.episode_title);
    fireEvent.click(screen.getByRole('button', { name: 'My episodes' }));
    const list = await screen.findByRole('dialog', { name: 'My episodes' });
    await within(list).findByText(OUTLINE.episode_title);
    fireEvent.click(within(list).getByRole('button', { name: /New Podcast/ }));

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await screen.findByRole('dialog', { name: 'My episodes' });
  });
});

describe('+ New Podcast: nothing from the old podcast leaks', () => {
  it('Test 5: a fully loaded demo (segments, guest questions, research, variations, intro/outro, comments) leaves nothing behind', async () => {
    mockApi({ generate: [respondWith(OUTLINE_B)] });
    renderAt('/app');
    fireEvent.click(await screen.findByRole('button', { name: /AI Coding|Tech/i }));
    await screen.findAllByText(/How AI Coding Assistants Are Rewiring Software Careers/);
    const demo = getDemo('tech');
    expect(demo.outline.variations.length).toBeGreaterThan(0);
    expect(demo.outline.intro_outro.hooks.length).toBeGreaterThan(0);
    expect(demo.comments.length).toBeGreaterThan(0);

    fireEvent.click(newPodcastButton()); // an unedited demo asks nothing
    await waitFor(() => expect(topic().value).toBe(''));

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeNull();
    // Now build Podcast B and look at every place Podcast A's data could have shown up.
    await generate({ topicText: 'B' });
    await screen.findAllByText('Podcast B Title');
    expect(screen.queryByText(/AI Coding Assistants/)).toBeNull();
    expect(screen.queryByRole('tab', { name: /Variations\s*\d/ })).toBeNull(); // no comparison structures
    fireEvent.click(screen.getByRole('tab', { name: /Intro and outro/ }));
    expect(await screen.findByText('Open strong, close cleanly')).toBeTruthy(); // no hooks or scripts yet
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(state.localComments).toEqual([]);
    expect(state.deepDive).toEqual({});
    expect(state.demoId).toBeNull();
    expect(state.outline.variations).toBeUndefined();
    expect(state.outline.intro_outro).toBeUndefined();
  });

  it('a generation still running when New Podcast is clicked is dropped instead of landing in the blank form', async () => {
    const calls = mockApi({ generate: 'hold' });
    renderAt('/app');
    await generate();
    await screen.findByRole('region', { name: 'Generating Outline' });

    fireEvent.click(newPodcastButton());
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Generating Outline' })).toBeNull());
    await act(async () => calls.releaseGenerate());

    await new Promise((r) => setTimeout(r, 50));
    expect(topic().value).toBe('');
    expect(screen.queryByText(OUTLINE.episode_title)).toBeNull();
    expect(screen.queryByText('Outline ready. Everything is editable.')).toBeNull();
    expect(screen.getByRole('button', { name: /Generate outline/ }).disabled).toBe(false);
  });

  it('a save that finishes after New Podcast is not attached to the blank workspace', async () => {
    let finishSave;
    const gate = new Promise((resolve) => (finishSave = resolve));
    signedInApi({
      'POST /api/projects': async () => {
        await gate;
        return jsonReply(201, { project: { id: 7, shareToken: null, updatedAt: '2026-01-01 10:00:00' } });
      },
    });
    renderAt('/app');
    await generate();
    await screen.findAllByText(OUTLINE.episode_title);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(newPodcastButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Discard & Create New' }));
    await waitFor(() => expect(topic().value).toBe(''));

    await act(async () => finishSave());

    await new Promise((r) => setTimeout(r, 50));
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored === null || JSON.parse(stored).activeProjectId === null).toBe(true);
  });
});

describe('shared page', () => {
  it('has a New Podcast button that opens the editor on a blank brief', async () => {
    mockApi({
      handlers: {
        'GET /api/shared/abc': () => jsonReply(200, { title: OUTLINE.episode_title, outline: OUTLINE, commentsEnabled: false, owner: 'maya' }),
      },
    });
    renderAt('/shared/abc');

    fireEvent.click(await screen.findByRole('button', { name: /New Podcast/ }));

    await screen.findByRole('heading', { name: 'Start with the brief' });
    expect(window.location.pathname).toBe('/app');
    expect(topic().value).toBe('');
  });
});

describe('reducer', () => {
  it('NEW_PODCAST returns the empty state from a saved project, leaving nothing behind', () => {
    let state = reducer(EMPTY_STATE, {
      type: 'LOAD_PROJECT',
      project: { id: 9, title: 'A', shareToken: 'tok', outline: OUTLINE, updatedAt: 'x', commentsEnabled: false },
    });
    state = reducer(state, { type: 'SET_FORM_FIELD', field: 'topic', value: 'Future of AI' });
    state = reducer(state, { type: 'SET_DEEP_DIVE', segmentId: 1, snapshot: 's', data: { notes: 'n' } });
    expect(state.activeProjectId).toBe(9);

    expect(reducer(state, { type: 'NEW_PODCAST' })).toBe(EMPTY_STATE);
  });

  it('ignores a Deep Dive answer when there is no outline any more', () => {
    expect(reducer(EMPTY_STATE, { type: 'SET_DEEP_DIVE', segmentId: 1, snapshot: 's', data: {} })).toBe(EMPTY_STATE);
  });
});
