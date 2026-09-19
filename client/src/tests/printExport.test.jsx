// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { OUTLINE, mockApi, renderAt, resetBrowser, respondWith } from './helpers.jsx';
import { EMPTY_STATE, reducer } from '../hooks/workspaceReducer.js';
import { segmentContentKey } from '../utils/segmentSnapshot.js';
import { WORKSPACE_KEY } from '../services/session.js';

// A finished script has everything: guest questions, transitions, an intro and an outro.
const RICH = {
  ...OUTLINE,
  intro: 'Welcome to the show, everyone.',
  guest_questions: ['What first drew you to lighthouses?', 'What surprised you most?'],
  outro: 'Thanks for listening. Subscribe today!',
};

let print;
beforeEach(() => {
  resetBrowser();
  print = vi.spyOn(window, 'print').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  resetBrowser();
});

async function generateAndEdit() {
  mockApi({ generate: respondWith(RICH) });
  renderAt('/app');
  fireEvent.change(await screen.findByLabelText(/Topic/), { target: { value: 'Lighthouses' } });
  fireEvent.change(screen.getByLabelText('Podcast name'), { target: { value: 'Salt and Signal' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Duo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Generate outline' }));
  await screen.findByRole('button', { name: 'Edit episode title' });

  // Edit after generating: the printout must show these, not the AI's original words.
  fireEvent.click(screen.getByRole('button', { name: 'Edit episode title' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'episode title' }), { target: { value: 'Edited Episode Title' } });
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'episode title' }), { key: 'Enter' });
  fireEvent.click(await screen.findByRole('button', { name: 'Edit title of segment 1' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'title of segment 1' }), { target: { value: 'Edited first segment' } });
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'title of segment 1' }), { key: 'Enter' });
  await screen.findByText('Edited first segment');
}

const openExportDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Export Script' }));
  return screen.findByRole('dialog', { name: 'Export Script' });
};
const openPreview = async () => {
  const dialog = await openExportDialog();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Open Print Preview' }));
  return screen.findByRole('dialog', { name: 'Print preview' });
};

describe('Export Script dialog', () => {
  it('opens from the button and offers PDF / Print, Markdown and Plain text', async () => {
    await generateAndEdit();
    const dialog = await openExportDialog();

    expect(within(dialog).getByText('PDF / Print')).toBeTruthy();
    expect(within(dialog).getByText('Markdown')).toBeTruthy();
    expect(within(dialog).getByText('Plain text')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Open Print Preview' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Download .md' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Download .txt' })).toBeTruthy();
  });

  it('closes with Escape and leaves the workspace alone', async () => {
    await generateAndEdit();
    await openExportDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Edited first segment')).toBeTruthy();
  });
});

describe('PDF / Print workflow: generate, edit, export, preview, print', () => {
  it('opens a Print Preview with every required section, from the CURRENT edited outline', async () => {
    await generateAndEdit();
    const preview = await openPreview();
    const page = within(preview);

    // Not the export dialog any more; a dedicated preview.
    expect(screen.queryByRole('dialog', { name: 'Export Script' })).toBeNull();

    // Edits, not the original AI response.
    expect(page.getByText('Edited Episode Title')).toBeTruthy();
    expect(page.getByText('Edited first segment')).toBeTruthy();
    expect(page.queryByText('Segment 1 title')).toBeNull();
    expect(page.queryByText('Mocked Jazz Episode')).toBeNull();

    // Header facts.
    expect(page.getByText('Salt and Signal')).toBeTruthy(); // podcast name
    expect(page.getByText('Duo')).toBeTruthy(); // host information
    expect(page.getByText('Conversational')).toBeTruthy(); // tone
    expect(page.getByText('30 mins')).toBeTruthy(); // total duration

    // Body.
    expect(page.getByText('Opening hook and introduction')).toBeTruthy();
    expect(page.getByText('Welcome to the show, everyone.')).toBeTruthy();
    expect(page.getAllByText(/6 mins/).length).toBe(5); // a duration for every segment
    expect(page.getAllByText('First point').length).toBe(5); // talking points
    expect(page.getAllByText('Transition: On to the next.').length).toBe(5);
    expect(page.getByText('Guest Questions')).toBeTruthy();
    expect(page.getByText('What first drew you to lighthouses?')).toBeTruthy();
    expect(page.getByText('Outro and call to action')).toBeTruthy();
    expect(page.getByText('Thanks for listening. Subscribe today!')).toBeTruthy();
    expect(page.getAllByRole('heading', { level: 2 })).toHaveLength(8); // intro + 5 segments + guests + outro
  });

  it('has a clear Print / Save as PDF button at the top that calls the browser print dialog', async () => {
    await generateAndEdit();
    const preview = await openPreview();
    const button = within(preview).getByRole('button', { name: 'Print / Save as PDF' });

    // It is in the toolbar, above the script.
    const script = preview.querySelector('.script');
    expect(button.compareDocumentPosition(script) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(preview).getByText(/choose/i).textContent).toContain('Save as PDF');
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('ships print CSS that hides the app and controls and prints black on white', async () => {
    await generateAndEdit();
    const preview = await openPreview();
    const css = preview.querySelector('style').textContent;
    const printRules = css.slice(css.indexOf('@media print'));

    expect(printRules).toMatch(/#root[^}]*display: none/); // sidebar, navigation, workspace
    expect(printRules).toMatch(/\.no-print[^}]*display: none/); // toolbar and buttons
    expect(printRules).toMatch(/color: #000 !important/);
    expect(printRules).toMatch(/background: transparent !important/);
    expect(printRules).toMatch(/box-shadow: none !important/);
    expect(css).toMatch(/@page \{[^}]*margin/);
    expect(css).toMatch(/break-inside: avoid/);
    // The preview toolbar carries the class that print hides; the script itself does not.
    expect(preview.querySelector('.no-print button')).toBeTruthy();
    expect(preview.querySelector('.script .no-print')).toBeNull();
  });

  it('closing the preview returns to the workspace with every edit intact', async () => {
    await generateAndEdit();
    const preview = await openPreview();

    fireEvent.click(within(preview).getByRole('button', { name: 'Close preview' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Edited Episode Title')).toBeTruthy();
    expect(screen.getByText('Edited first segment')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)).outline.episode_title).toBe('Edited Episode Title');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Export Script' })));
    expect(print).not.toHaveBeenCalled(); // closing is not printing
  });

  it('Escape also closes the preview without losing anything', async () => {
    await generateAndEdit();
    await openPreview();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Print preview' })).toBeNull());
    expect(screen.getByText('Edited first segment')).toBeTruthy();
  });

  it('a second preview after more edits shows the newest words', async () => {
    await generateAndEdit();
    fireEvent.click(within(await openPreview()).getByRole('button', { name: 'Close preview' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Edit title of segment 2' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'title of segment 2' }), { target: { value: 'Added later' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'title of segment 2' }), { key: 'Enter' });

    expect(within(await openPreview()).getByText('Added later')).toBeTruthy();
  });
});

describe('sections that are not available are omitted cleanly', () => {
  it('leaves out guest questions, research notes and sources when there are none', async () => {
    mockApi(); // the default outline has no guest questions, notes or sources
    renderAt('/app');
    fireEvent.change(await screen.findByLabelText(/Topic/), { target: { value: 'Lighthouses' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate outline' }));
    await screen.findByRole('button', { name: 'Edit episode title' });

    const dialog = await openExportDialog();
    expect(within(dialog).queryByText(/Include guest questions/)).toBeNull();
    expect(within(dialog).queryByText(/Include Deep Dive research notes/)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open Print Preview' }));
    const page = within(await screen.findByRole('dialog', { name: 'Print preview' }));

    expect(page.queryByText('Guest Questions')).toBeNull();
    expect(page.queryByText('Research notes')).toBeNull();
    expect(page.queryByText(/Sources/)).toBeNull();
    expect(page.getByText('Outro and call to action')).toBeTruthy(); // the rest is still there
  });

  it('lets the user switch guest questions off for the printout', async () => {
    await generateAndEdit();
    const dialog = await openExportDialog();
    fireEvent.click(within(dialog).getByLabelText('Include guest questions'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open Print Preview' }));

    const page = within(await screen.findByRole('dialog', { name: 'Print preview' }));
    expect(page.queryByText('Guest Questions')).toBeNull();
    expect(page.getByText('Opening hook and introduction')).toBeTruthy();
  });
});

describe('research notes and sources in the printout', () => {
  function seedDemo({ fresh }) {
    let state = reducer(EMPTY_STATE, { type: 'LOAD_DEMO', id: 'tech' });
    const segment = state.outline.segments[0];
    state = reducer(state, {
      type: 'SET_DEEP_DIVE',
      segmentId: segment.id,
      snapshot: fresh ? segmentContentKey(segment) : 'an older version of the segment',
      data: { notes: 'Lighthouse keepers logged every ship they saw.\n\nThe logs survive today.', discussion_prompts: ['What would you have logged?'] },
    });
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state));
    mockApi();
  }

  it('offers Deep Dive notes when they are up to date, and prints them on request', async () => {
    seedDemo({ fresh: true });
    renderAt('/app');
    const dialog = await openExportDialog();

    expect(within(dialog).getByText(/1 segment has up-to-date Deep Dive notes/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open Print Preview' }));
    const page = within(await screen.findByRole('dialog', { name: 'Print preview' }));

    expect(page.getByText('Research notes')).toBeTruthy();
    expect(page.getByText('Lighthouse keepers logged every ship they saw.')).toBeTruthy();
    expect(page.getByText('What would you have logged?')).toBeTruthy();
  });

  it('leaves the notes out when the box is unticked', async () => {
    seedDemo({ fresh: true });
    renderAt('/app');
    const dialog = await openExportDialog();
    fireEvent.click(within(dialog).getByLabelText(/Include Deep Dive research notes/));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open Print Preview' }));

    expect(within(await screen.findByRole('dialog', { name: 'Print preview' })).queryByText('Research notes')).toBeNull();
  });

  it('finds the notes checkbox by that label when the notes are current (so the absence check below is meaningful)', async () => {
    seedDemo({ fresh: true });
    renderAt('/app');
    const dialog = await openExportDialog();
    expect(within(dialog).getByLabelText(/Include Deep Dive research notes/)).toBeTruthy();
  });

  it('does not offer notes that no longer match their segment', async () => {
    seedDemo({ fresh: false });
    renderAt('/app');
    const dialog = await openExportDialog();
    expect(within(dialog).queryByLabelText(/Include Deep Dive research notes/)).toBeNull();
  });

  it('prints pinned sources with their URLs when asked', async () => {
    seedDemo({ fresh: true });
    renderAt('/app');
    const dialog = await openExportDialog();
    fireEvent.click(within(dialog).getByLabelText(/Include a Sources section/));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open Print Preview' }));

    const preview = await screen.findByRole('dialog', { name: 'Print preview' });
    expect(within(preview).getAllByText(/Sources/).length).toBeGreaterThan(0);
    expect(preview.textContent).toContain('https://en.wikipedia.org/wiki/');
  });
});

describe('Markdown and plain text exports are unchanged', () => {
  function captureDownloads() {
    const files = [];
    URL.createObjectURL = vi.fn((blob) => {
      files.push(blob);
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      files[files.length - 1].name = this.download;
    });
    return files;
  }

  it('Download .md still downloads a Markdown file of the current edits', async () => {
    await generateAndEdit();
    const files = captureDownloads();
    const dialog = await openExportDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Download .md' }));

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('edited-episode-title.md');
    const text = await files[0].text();
    expect(text).toContain('# Edited Episode Title');
    expect(text).toContain('## Segment 1: Edited first segment');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('dialog', { name: 'Print preview' })).toBeNull(); // not the print route
  });

  it('Download .txt still downloads plain text of the current edits', async () => {
    await generateAndEdit();
    const files = captureDownloads();
    const dialog = await openExportDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Download .txt' }));

    expect(files[0].name).toBe('edited-episode-title.txt');
    const text = await files[0].text();
    expect(text).toContain('EDITED EPISODE TITLE');
    expect(text).toContain('SEGMENT 1: EDITED FIRST SEGMENT');
  });
});
