// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { OUTLINE, mockApi, renderAt, resetBrowser } from './helpers.jsx';

// A browser that cannot read a response body as a stream (or has no TextDecoder): the streaming capability
// check says no, and generation must be exactly the ordinary request, with no attempt to stream.
vi.mock('../services/api.js', async (importOriginal) => ({ ...(await importOriginal()), streamingSupported: () => false }));

beforeEach(resetBrowser);
afterEach(resetBrowser);

describe('a browser without streaming support', () => {
  it('generates with the ordinary request and never opens the stream', async () => {
    const calls = mockApi();
    renderAt('/app');
    fireEvent.change(await screen.findByLabelText(/Topic/), { target: { value: 'Lighthouses' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate outline' }));

    await screen.findAllByText(OUTLINE.episode_title);

    expect(calls).toContain('POST /api/generate-outline');
    expect(calls).not.toContain('POST /api/generate-outline/stream');
  });

  it('shows the timer-based estimate, as before streaming existed', async () => {
    mockApi({ generate: 'hold' });
    renderAt('/app');
    fireEvent.change(await screen.findByLabelText(/Topic/), { target: { value: 'Lighthouses' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate outline' }));

    const region = await screen.findByRole('region', { name: 'Generating Outline' });

    expect(region.querySelector('[role="progressbar"]').getAttribute('aria-label')).toBe('Generation progress (estimated)');
    expect(screen.queryByTestId('generation-detail')).toBeNull();
  });
});
