// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { OUTLINE, jsonReply, mockApi, renderAt, resetBrowser } from './helpers.jsx';
import { GENERATION_STEPS } from '../components/GenerationProgress.jsx';

beforeEach(resetBrowser);
afterEach(() => {
  vi.useRealTimers();
  resetBrowser();
});

const STREAM = 'POST /api/generate-outline/stream';
const PLAIN = 'POST /api/generate-outline';

/**
 * A server-sent event stream the test controls: `send(event, data)` delivers an event to the page as if the
 * server had written it, `close()` ends the stream, `fail()` breaks the connection. `handler` plugs into mockApi.
 */
function serverStream() {
  const encoder = new TextEncoder();
  let controller;
  let signal;
  const body = new ReadableStream({
    start(c) {
      controller = c;
    },
  });
  return {
    handler: (init) => {
      signal = init.signal;
      init.signal?.addEventListener('abort', () => {
        try {
          controller.error(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
        } catch {
          /* already closed */
        }
      });
      return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    },
    send: (event, data) => act(async () => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))),
    // (the page stops reading, and cancels the stream, at its last event, so a later close or fail on it is fine)
    close: () =>
      act(async () => {
        try {
          controller.close();
        } catch {
          /* already cancelled */
        }
      }),
    fail: () =>
      act(async () => {
        try {
          controller.error(new TypeError('network error'));
        } catch {
          /* already cancelled */
        }
      }),
    aborted: () => signal?.aborted === true,
  };
}

const progress = (stage, fraction, drafted = 0, expected = 6) => ({ stage, fraction, segmentsDrafted: drafted, segmentsExpected: expected, chars: Math.round(fraction * 3000) });

async function startGeneration(buttonName = 'Generate outline') {
  fireEvent.change(await screen.findByLabelText(/Topic/), { target: { value: 'Lighthouses' } });
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
}

const panel = () => screen.findByRole('region', { name: 'Generating Outline' });
const stepStates = (region) => within(region).getAllByRole('listitem').map((li) => li.getAttribute('aria-current') === 'step');
const activeStep = (region) => stepStates(region).indexOf(true);

describe('progress from the stream', () => {
  it('follows what the server reports: the bar, the current step and the sentence under it all come from real events', async () => {
    const server = serverStream();
    const calls = mockApi({ handlers: { [STREAM]: server.handler } });
    renderAt('/app');
    await startGeneration();
    const region = await panel();

    // Before anything is written: real "waiting", 0%, and the bar is no longer labelled an estimate.
    expect(within(region).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(within(region).getByRole('progressbar').getAttribute('aria-label')).toBe('Generation progress');
    expect(within(region).getByTestId('generation-detail').textContent).toBe('Waiting for the model to start writing.');

    await server.send('start', {});
    await server.send('progress', progress('title', 0.06));
    await waitFor(() => expect(within(region).getByTestId('generation-detail').textContent).toBe('Titling the episode.'));

    await server.send('progress', progress('segments', 0.46, 3, 6));
    await waitFor(() => expect(within(region).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('46'));
    expect(within(region).getByTestId('generation-detail').textContent).toBe('3 of about 6 segments drafted.');
    expect(activeStep(region)).toBe(1); // "Structuring narrative flow"
    expect(within(region).getAllByRole('listitem')[0].textContent).toContain('done');

    await server.send('progress', progress('questions', 0.85, 6, 6));
    await waitFor(() => expect(within(region).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('85'));
    expect(activeStep(region)).toBe(2);

    await server.send('progress', progress('outro', 0.93, 6, 6));
    await waitFor(() => expect(activeStep(region)).toBe(3));
    expect(within(region).getByTestId('generation-detail').textContent).toBe('Writing the outro.');

    // The finished outline replaces the card, and no second (plain) request was ever made.
    await server.send('result', { outline: OUTLINE });
    await server.close();
    await screen.findAllByText(OUTLINE.episode_title);
    expect(screen.queryByRole('region', { name: 'Generating Outline' })).toBeNull();
    expect(calls).toContain(STREAM);
    expect(calls).not.toContain(PLAIN);
  });

  it('does not run its own timer while real progress is coming in (0% stays 0% however long the model takes)', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const server = serverStream();
    mockApi({ handlers: { [STREAM]: server.handler } });
    renderAt('/app');
    await startGeneration();
    const region = await panel();

    act(() => vi.advanceTimersByTime(60_000)); // a slow, cold model

    expect(within(region).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0'); // not the timer's ~92%
    expect(activeStep(region)).toBe(0);
  });

  it('never moves a step backwards, and starts over when the server says it is retrying', async () => {
    const server = serverStream();
    mockApi({ handlers: { [STREAM]: server.handler } });
    renderAt('/app');
    await startGeneration();
    const region = await panel();

    await server.send('progress', progress('questions', 0.85, 6, 6));
    await waitFor(() => expect(activeStep(region)).toBe(2));
    await server.send('progress', progress('segments', 0.5, 3, 6)); // an out-of-order event
    await waitFor(() => expect(within(region).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50'));
    expect(activeStep(region)).toBe(2); // the step did not go back

    await server.send('progress', { ...progress('retrying', 0, 0, 6), reason: 'retry' });
    await waitFor(() => expect(within(region).getByTestId('generation-detail').textContent).toMatch(/didn't pass checks/));
    expect(within(region).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(activeStep(region)).toBe(0);
  });

  it('announces the real stage to screen readers', async () => {
    const server = serverStream();
    mockApi({ handlers: { [STREAM]: server.handler } });
    renderAt('/app');
    await startGeneration();
    const region = await panel();

    await server.send('progress', progress('segments', 0.46, 3, 6));

    await waitFor(() => expect(within(region).getByRole('status').textContent).toBe(`Step 2 of 4: ${GENERATION_STEPS[1]}. 3 of about 6 segments drafted.`));
  });
});

describe('falling back to the ordinary request (generation itself never breaks)', () => {
  it('uses the plain request and the timer estimate when the server has no streaming route (an older server)', async () => {
    const calls = mockApi(); // the stream route is "not mocked": 404
    renderAt('/app');
    await startGeneration();

    await screen.findAllByText(OUTLINE.episode_title);

    expect(calls).toEqual(expect.arrayContaining([STREAM, PLAIN]));
    expect(calls.indexOf(STREAM)).toBeLessThan(calls.indexOf(PLAIN));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the timer-based estimate while the fallback request is running', async () => {
    const calls = mockApi({ generate: 'hold' });
    renderAt('/app');
    await startGeneration();
    const region = await panel();

    await waitFor(() => expect(calls).toContain(PLAIN)); // the stream 404ed and the plain request is now waiting
    expect(within(region).getByRole('progressbar').getAttribute('aria-label')).toBe('Generation progress (estimated)');
    expect(screen.queryByTestId('generation-detail')).toBeNull();
    await act(async () => calls.releaseGenerate());
    await screen.findAllByText(OUTLINE.episode_title);
  });

  it('falls back when the connection breaks mid-stream, and the user just gets their outline', async () => {
    const server = serverStream();
    const calls = mockApi({ handlers: { [STREAM]: server.handler } });
    renderAt('/app');
    await startGeneration();
    await panel();
    await server.send('progress', progress('segments', 0.46, 3, 6));

    await server.fail();

    await screen.findAllByText(OUTLINE.episode_title);
    expect(calls).toContain(PLAIN);
    expect(screen.queryByRole('alert')).toBeNull(); // no error card: nothing failed from the user's point of view
  });

  it('falls back when the stream ends without a result', async () => {
    const server = serverStream();
    const calls = mockApi({ handlers: { [STREAM]: server.handler } });
    renderAt('/app');
    await startGeneration();
    await panel();
    await server.send('start', {});

    await server.close(); // ended cleanly, but no `result` event

    await screen.findAllByText(OUTLINE.episode_title);
    expect(calls).toContain(PLAIN);
  });

  it('falls back when the server answers with something that is not a stream', async () => {
    const calls = mockApi({ handlers: { [STREAM]: () => new Response('<html>Bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }) } });
    renderAt('/app');
    await startGeneration();

    await screen.findAllByText(OUTLINE.episode_title);
    expect(calls).toContain(PLAIN);
  });

  it('shows the plain request\'s own error if the fallback fails too', async () => {
    const server = serverStream();
    mockApi({ handlers: { [STREAM]: server.handler }, generate: () => jsonReply(502, { error: 'Bad answer.', code: 'LLM_INVALID_RESPONSE' }) });
    renderAt('/app');
    await startGeneration();
    await panel();

    await server.fail();

    expect(await within(await screen.findByRole('alert')).findByText(/didn't pass checks/i)).toBeTruthy();
  });
});

describe('errors the server chose to send are final (no second request that would spend more quota)', () => {
  it.each([
    ['LLM_TIMEOUT', 'Model timed out.', /The model took too long/],
    ['LLM_RATE_LIMITED', 'Provider limit.', /provider's limit was reached/],
    ['LLM_INVALID_RESPONSE', 'Bad answer.', /didn't pass checks/],
    ['LLM_NOT_CONFIGURED', 'No key.', /isn't set up yet/],
  ])('an error event with %s shows the error card and does not retry with the plain request', async (code, error, title) => {
    const server = serverStream();
    const calls = mockApi({ handlers: { [STREAM]: server.handler } });
    renderAt('/app');
    await startGeneration();
    await panel();
    await server.send('progress', progress('segments', 0.3, 2, 6));

    await server.send('error', { error, code });

    expect(await within(await screen.findByRole('alert')).findByText(title)).toBeTruthy();
    expect(calls).not.toContain(PLAIN);
    expect(screen.queryByRole('region', { name: 'Generating Outline' })).toBeNull(); // the progress card is gone
  });

  it('a validation error or a rate limit answered as plain JSON is final too', async () => {
    const calls = mockApi({ handlers: { [STREAM]: () => jsonReply(429, { error: 'Too many requests.', code: 'RATE_LIMITED' }) } });
    renderAt('/app');
    await startGeneration();

    expect(await within(await screen.findByRole('alert')).findByText(/Too many requests/)).toBeTruthy();
    expect(calls).not.toContain(PLAIN);
  });

  it('Retry Generation after a streamed error streams again', async () => {
    const first = serverStream();
    const second = serverStream();
    const streams = [first, second];
    const calls = mockApi({ handlers: { [STREAM]: (init) => streams.shift().handler(init) } });
    renderAt('/app');
    await startGeneration();
    await panel();
    await first.send('error', { error: 'Timed out.', code: 'LLM_TIMEOUT' });

    fireEvent.click(await screen.findByRole('button', { name: 'Retry Generation' }));
    await panel();
    await second.send('result', { outline: OUTLINE });
    await second.close();

    await screen.findAllByText(OUTLINE.episode_title);
    expect(calls.filter((c) => c === STREAM)).toHaveLength(2);
    expect(calls).not.toContain(PLAIN);
  });
});

describe('what streaming does not change', () => {
  it('leaves structure comparison (2 or 3 outlines) on the ordinary request', async () => {
    const calls = mockApi();
    renderAt('/app');
    fireEvent.click(await screen.findByRole('radio', { name: '2 structures' }));
    await startGeneration('Generate 2 structures');
    await screen.findByRole('alert'); // the fake server has no variations route, so this ends in an error card

    expect(calls).toContain('POST /api/generate-variations');
    expect(calls).not.toContain(STREAM);
  });

  it('sends the same brief as the plain request: topic, tone, hosts, length, guest', async () => {
    let body;
    mockApi({ handlers: { [STREAM]: (init) => ((body = JSON.parse(init.body)), jsonReply(500, { error: 'x', code: 'INTERNAL_ERROR' })) } });
    renderAt('/app');
    fireEvent.change(await screen.findByLabelText(/Topic/), { target: { value: 'Lighthouses' } });
    fireEvent.click(screen.getByLabelText('This episode has a guest'));
    fireEvent.change(screen.getByLabelText(/Guest name/), { target: { value: 'Dr. Okafor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate outline' }));

    await screen.findByRole('alert');
    expect(body).toMatchObject({ topic: 'Lighthouses', tone: 'Conversational', hostCount: 'solo', lengthMins: 30, includeGuests: true, guestNames: 'Dr. Okafor' });
  });
});

describe('leaving while it streams', () => {
  it('starting a new podcast cancels the stream (so the model stops), and the late result never appears', async () => {
    const server = serverStream();
    mockApi({ handlers: { [STREAM]: server.handler } });
    renderAt('/app');
    await startGeneration();
    await panel();
    await server.send('progress', progress('segments', 0.3, 2, 6));

    fireEvent.click(screen.getByRole('button', { name: /New Podcast/ })); // nothing to lose yet: no prompt

    await waitFor(() => expect(server.aborted()).toBe(true));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Generating Outline' })).toBeNull());
    expect(screen.getByLabelText(/Topic/).value).toBe('');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByText(OUTLINE.episode_title)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull(); // cancelling is not an error
    expect(screen.getByRole('button', { name: 'Generate outline' }).disabled).toBe(false);
  });
});
