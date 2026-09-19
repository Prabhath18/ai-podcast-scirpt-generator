import { describe, it, expect } from 'vitest';
import { readSse } from '../services/sse.js';

/** A body (something with getReader) that delivers `pieces` as separate network chunks, then ends or fails. */
const bodyOf = (pieces, { failWith } = {}) => {
  const encoder = new TextEncoder();
  const queue = [...pieces];
  return {
    getReader: () => ({
      read: async () => {
        if (queue.length === 0) {
          if (failWith) throw failWith;
          return { done: true, value: undefined };
        }
        return { done: false, value: encoder.encode(queue.shift()) };
      },
    }),
  };
};

const collect = async (pieces, options) => {
  const events = [];
  await readSse(bodyOf(pieces, options), (event) => events.push(event));
  return events;
};

describe('readSse', () => {
  it('reads named events, one per blank line', async () => {
    expect(await collect(['event: progress\ndata: {"n":1}\n\nevent: result\ndata: {"ok":true}\n\n'])).toEqual([
      { event: 'progress', data: '{"n":1}' },
      { event: 'result', data: '{"ok":true}' },
    ]);
  });

  it('reassembles an event that is split across network chunks, even in the middle of a word or a line ending', async () => {
    const whole = 'event: progress\ndata: {"stage":"segments"}\n\n';
    const pieces = [whole.slice(0, 5), whole.slice(5, 22), whole.slice(22, whole.length - 1), whole.slice(-1)];

    expect(await collect(pieces)).toEqual([{ event: 'progress', data: '{"stage":"segments"}' }]);
  });

  it('does not split a multi-byte character that arrives in two chunks', async () => {
    const bytes = new TextEncoder().encode('event: x\ndata: "café ☕"\n\n');
    const cut = bytes.indexOf(0xe2) + 1; // inside the three-byte "☕"
    const body = {
      getReader: () => {
        const parts = [bytes.slice(0, cut), bytes.slice(cut)];
        return { read: async () => (parts.length ? { done: false, value: parts.shift() } : { done: true }) };
      },
    };
    const events = [];
    await readSse(body, (e) => events.push(e));

    expect(JSON.parse(events[0].data)).toBe('café ☕');
  });

  it('handles CRLF line endings', async () => {
    expect(await collect(['event: progress\r\ndata: {"a":1}\r\n\r\nevent: result\r\ndata: {}\r\n\r\n'])).toEqual([
      { event: 'progress', data: '{"a":1}' },
      { event: 'result', data: '{}' },
    ]);
  });

  it('ignores comment lines (the server\'s keep-alive) and events with no data', async () => {
    expect(await collect([': keep-alive\n\n', 'event: progress\ndata: {}\n\n', ': another\n\nevent: empty\n\n'])).toEqual([{ event: 'progress', data: '{}' }]);
  });

  it('joins a multi-line data field with newlines, and calls an unnamed event "message"', async () => {
    expect(await collect(['data: line one\ndata: line two\n\n'])).toEqual([{ event: 'message', data: 'line one\nline two' }]);
  });

  it('dispatches a last event that has no closing blank line', async () => {
    expect(await collect(['event: result\ndata: {"done":true}'])).toEqual([{ event: 'result', data: '{"done":true}' }]);
  });

  it('resolves with no events for an empty stream', async () => {
    expect(await collect([])).toEqual([]);
  });

  it('delivers events as they arrive, not all at the end', async () => {
    const seen = [];
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const encoder = new TextEncoder();
    const body = {
      getReader: () => {
        let step = 0;
        return {
          read: async () => {
            if (step++ === 0) return { done: false, value: encoder.encode('event: a\ndata: 1\n\n') };
            await gate; // the second chunk is held back
            return step === 2 ? { done: false, value: encoder.encode('event: b\ndata: 2\n\n') } : { done: true };
          },
        };
      },
    };

    const finished = readSse(body, (e) => seen.push(e.event));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen).toEqual(['a']); // the first event was handed over while the stream was still open
    release();
    await finished;
    expect(seen).toEqual(['a', 'b']);
  });

  it('rejects if reading fails, after delivering what had already arrived', async () => {
    const events = [];
    const error = await readSse(bodyOf(['event: a\ndata: 1\n\n'], { failWith: new TypeError('network error') }), (e) => events.push(e)).catch((e) => e);

    expect(error.message).toBe('network error');
    expect(events).toEqual([{ event: 'a', data: '1' }]);
  });
});

describe('readSse: stopping at the last event', () => {
  it('stops reading and cancels the connection when the callback returns true, even if the server keeps it open', async () => {
    const encoder = new TextEncoder();
    let cancelled = false;
    let reads = 0;
    const body = {
      getReader: () => ({
        read: async () => {
          reads += 1;
          if (reads === 1) return { done: false, value: encoder.encode('event: progress\ndata: 1\n\nevent: result\ndata: 2\n\nevent: late\ndata: 3\n\n') };
          return new Promise(() => {}); // the server never closes the connection
        },
        cancel: async () => {
          cancelled = true;
        },
      }),
    };
    const seen = [];

    await readSse(body, ({ event }) => {
      seen.push(event);
      return event === 'result';
    });

    expect(seen).toEqual(['progress', 'result']); // nothing after the last event is delivered
    expect(cancelled).toBe(true);
    expect(reads).toBe(1);
  });
});
