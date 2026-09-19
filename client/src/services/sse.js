/**
 * Reads a Server-Sent Events body (a fetch Response's `body`) and calls `onEvent({ event, data })`
 * for each complete event, as it arrives. `data` is the raw text; the caller parses it.
 * If `onEvent` returns true, that was the last event that matters: reading stops and the connection is
 * closed, so a server that leaves the stream open after its final event cannot keep the caller waiting.
 *
 * fetch is used instead of EventSource because EventSource cannot send a POST body.
 * Handles events split across network chunks, CRLF line endings, `: comment` keep-alive lines,
 * and multi-line `data:` fields. Resolves when the stream ends; rejects if reading it fails.
 */
export async function readSse(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let stopped = false;

  const dispatch = (block) => {
    let event = 'message';
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      let value = colon < 0 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length > 0 && onEvent({ event, data: data.join('\n') }) === true) stopped = true;
  };

  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- reading a stream is inherently sequential
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop(); // the last piece may be half an event
    for (const block of blocks) {
      dispatch(block);
      if (stopped) break;
    }
    if (stopped) {
      // eslint-disable-next-line no-await-in-loop -- (inside the loop only because it returns straight away)
      await reader.cancel().catch(() => {});
      return;
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) dispatch(buffer);
}
