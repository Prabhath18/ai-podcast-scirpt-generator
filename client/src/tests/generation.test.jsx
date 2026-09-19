// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { OUTLINE, failWith, mockApi, renderAt, resetBrowser } from './helpers.jsx';
import { GENERATION_STEPS } from '../components/GenerationProgress.jsx';

beforeEach(resetBrowser);
afterEach(() => {
  vi.useRealTimers();
  resetBrowser();
});

async function startGeneration() {
  fireEvent.change(await screen.findByLabelText(/Topic/), { target: { value: 'Lighthouses' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate outline' }));
}

describe('generation progress', () => {
  it('shows the title, a progress bar, the four steps in order, and a preview skeleton while waiting', async () => {
    const calls = mockApi({ generate: 'hold' });
    renderAt('/app');
    await startGeneration();

    const panel = await screen.findByRole('region', { name: 'Generating Outline' });
    expect(within(panel).getByRole('progressbar')).toBeTruthy();
    const steps = within(panel).getAllByRole('listitem').map((li) => li.textContent);
    expect(steps).toHaveLength(4);
    GENERATION_STEPS.forEach((label, i) => expect(steps[i]).toContain(label));
    expect(within(panel).getAllByRole('listitem')[0].getAttribute('aria-current')).toBe('step');
    expect(screen.getByTestId('outline-skeleton')).toBeTruthy();

    // The real result replaces it.
    await act(async () => calls.releaseGenerate());
    await screen.findAllByText(OUTLINE.episode_title);
    expect(screen.queryByRole('region', { name: 'Generating Outline' })).toBeNull();
  });

  it('moves through the steps over time and never reaches 100% before the response', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    mockApi({ generate: 'hold' });
    renderAt('/app');
    await startGeneration();
    const panel = await screen.findByRole('region', { name: 'Generating Outline' });
    const items = () => within(panel).getAllByRole('listitem');

    act(() => vi.advanceTimersByTime(4000));
    expect(items()[0].textContent).toContain('done');
    expect(items()[1].getAttribute('aria-current')).toBe('step');

    act(() => vi.advanceTimersByTime(60000));
    expect(items()[3].getAttribute('aria-current')).toBe('step'); // stays on the last step
    expect(Number(within(panel).getByRole('progressbar').getAttribute('aria-valuenow'))).toBeLessThan(100);
  });

  it('uses the existing form and validation: an empty topic still shows the field error, not the panel', async () => {
    mockApi();
    renderAt('/app');
    fireEvent.click(await screen.findByRole('button', { name: 'Generate outline' }));
    await screen.findByText(/Add a topic/);
    expect(screen.queryByRole('region', { name: 'Generating Outline' })).toBeNull();
  });
});

describe('inline generation error', () => {
  it('shows a title, an explanation and both actions on the New Episode screen, with the form still there', async () => {
    mockApi({ generate: failWith(502, 'LLM_INVALID_RESPONSE') });
    renderAt('/app');
    await startGeneration();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { name: /didn't pass checks/i })).toBeTruthy();
    expect(within(alert).getByText(/failed validation/i)).toBeTruthy();
    expect(within(alert).getByRole('button', { name: 'Retry Generation' })).toBeTruthy();
    expect(within(alert).getByRole('button', { name: 'Back to Edit Settings' })).toBeTruthy();
    expect(window.location.pathname).toBe('/app'); // not a separate page
    expect(screen.getByLabelText(/Topic/).value).toBe('Lighthouses'); // settings untouched
    expect(screen.queryByRole('region', { name: 'Generating Outline' })).toBeNull();
    expect(document.activeElement).toBe(alert); // keyboard users land on it
  });

  it('Retry Generation runs the same request again and clears the error on success', async () => {
    const calls = mockApi({ generate: [failWith(429, 'RATE_LIMITED'), 'ok'] });
    renderAt('/app');
    await startGeneration();

    fireEvent.click(await screen.findByRole('button', { name: 'Retry Generation' }));

    await screen.findAllByText(OUTLINE.episode_title);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(calls.filter((c) => c === 'POST /api/generate-outline')).toHaveLength(2);
  });

  it('Back to Edit Settings dismisses the error and puts the cursor in the topic field', async () => {
    mockApi({ generate: failWith(500, 'INTERNAL_ERROR', 'Boom') });
    renderAt('/app');
    await startGeneration();

    fireEvent.click(await screen.findByRole('button', { name: 'Back to Edit Settings' }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/Topic/)));
    expect(screen.getByLabelText(/Topic/).value).toBe('Lighthouses');
  });

  it('explains each known failure in plain words', async () => {
    const cases = [
      [failWith(429, 'RATE_LIMITED'), /Too many requests/],
      [failWith(503, 'LLM_NOT_CONFIGURED'), /isn't set up yet/],
      [failWith(500, 'INTERNAL_ERROR', 'The server exploded.'), /The server exploded\./],
    ];
    for (const [generate, expected] of cases) {
      mockApi({ generate });
      const view = renderAt('/app');
      await startGeneration();
      expect(await within(await screen.findByRole('alert')).findByText(expected)).toBeTruthy();
      view.unmount();
      resetBrowser();
    }
  });

  it('a missing API key offers to open a demo instead', async () => {
    mockApi({ generate: failWith(503, 'LLM_NOT_CONFIGURED') });
    renderAt('/app');
    await startGeneration();

    fireEvent.click(await screen.findByRole('button', { name: 'Open a demo' }));

    await screen.findAllByText(/How AI Coding Assistants Are Rewiring Software Careers/);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('no longer reports generation failures as toasts', async () => {
    mockApi({ generate: failWith(502, 'LLM_INVALID_RESPONSE') });
    renderAt('/app');
    await startGeneration();
    await screen.findByRole('alert');
    // The only role=alert is the inline card; toasts use role=status.
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});

describe('My episodes empty state', () => {
  async function openEpisodes() {
    fireEvent.click(await screen.findByRole('button', { name: 'My episodes' }));
    return screen.findByRole('dialog', { name: 'My episodes' });
  }

  it('says there are no episodes yet and offers Create Your First Episode', async () => {
    mockApi({ signedIn: true, projects: [] });
    renderAt('/app');
    const dialog = await openEpisodes();

    expect(await within(dialog).findByText('No episodes drafted yet')).toBeTruthy();
    expect(within(dialog).getByText(/generate an outline, then choose Save/i)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Create Your First Episode' })).toBeTruthy();
  });

  it('Create Your First Episode closes the dialog and focuses the topic field', async () => {
    mockApi({ signedIn: true, projects: [] });
    renderAt('/app');
    const dialog = await openEpisodes();

    fireEvent.click(await within(dialog).findByRole('button', { name: 'Create Your First Episode' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/Topic/)));
  });

  it('shows the list, not the empty state, when there are episodes', async () => {
    mockApi({ signedIn: true, projects: [{ id: 1, title: 'Saved one', updatedAt: '2026-01-01 10:00:00', outline: OUTLINE }] });
    renderAt('/app');
    const dialog = await openEpisodes();

    expect(await within(dialog).findByText('Saved one')).toBeTruthy();
    expect(within(dialog).queryByText('No episodes drafted yet')).toBeNull();
  });
});
