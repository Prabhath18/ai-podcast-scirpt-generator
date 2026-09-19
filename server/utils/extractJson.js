// Open models rarely return bare JSON. They wrap it in ```json fences, put a sentence
// before or after it, or (reasoning models) think aloud inside <think> tags first.
// extractJson() finds the JSON object inside all of that and returns it as a string, so
// the one JSON.parse in llmHelper.js sees clean input. If it finds nothing it returns the
// trimmed text unchanged, and that parse fails the same way it always did (which is what
// triggers the single retry).

function parses(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function stripThinking(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '');
}

/** Index of the "}" that closes the "{" at `start`, skipping braces inside strings; -1 if unbalanced. */
function closingBrace(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** The first balanced {...} in `text` that is valid JSON. Stray braces in prose are skipped. */
function firstJsonObject(text) {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    const end = closingBrace(text, start);
    if (end === -1) continue;
    const candidate = text.slice(start, end + 1);
    if (parses(candidate)) return candidate;
  }
  return null;
}

export function extractJson(raw) {
  const text = stripThinking(String(raw ?? '')).trim();
  if (!text || parses(text)) return text;

  for (const fence of text.matchAll(/```[a-zA-Z]*\s*([\s\S]*?)```/g)) {
    const inner = firstJsonObject(fence[1]);
    if (inner) return inner;
  }
  return firstJsonObject(text) ?? text;
}
