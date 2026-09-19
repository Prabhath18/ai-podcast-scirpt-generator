import { describe, it, expect } from 'vitest';
import { extractJson } from '../utils/extractJson.js';
import { exampleFromSchema, toJsonSchema } from '../services/llm/jsonSchema.js';
import { guestQuestionsResponseSchema, outlineResponseSchema } from '../prompts/schemas.js';

const parsed = (text) => JSON.parse(extractJson(text));

describe('extractJson: JSON that arrives wrapped in something', () => {
  const object = { title: 'A "quoted" title', points: ['one', 'two'], nested: { ok: true } };
  const body = JSON.stringify(object, null, 2);

  it('leaves bare JSON alone', () => {
    expect(parsed(body)).toEqual(object);
    expect(extractJson(`  ${body}\n`)).toBe(body);
  });

  it('strips a ```json fence', () => {
    expect(parsed('```json\n' + body + '\n```')).toEqual(object);
  });

  it('strips a bare ``` fence and an uppercase ```JSON fence', () => {
    expect(parsed('```\n' + body + '\n```')).toEqual(object);
    expect(parsed('```JSON\n' + body + '\n```')).toEqual(object);
  });

  it('finds JSON inside a fence that has prose around it', () => {
    expect(parsed(`Sure! Here is the outline you asked for:\n\n\`\`\`json\n${body}\n\`\`\`\n\nLet me know if you want changes.`)).toEqual(object);
  });

  it('finds JSON surrounded by prose with no fence', () => {
    expect(parsed(`Here you go: ${body} Hope that helps!`)).toEqual(object);
  });

  it('copes with an unclosed fence (a truncated reply)', () => {
    expect(parsed('```json\n' + body)).toEqual(object);
  });

  it('ignores braces in the prose before the JSON', () => {
    expect(parsed(`Use {curly braces} for objects, like this: ${body}`)).toEqual(object);
  });

  it('ignores braces in the prose after the JSON', () => {
    expect(parsed(`${body}\n\nNote: replace {placeholders} as needed.`)).toEqual(object);
  });

  it('is not fooled by braces and escaped quotes inside string values', () => {
    const tricky = { text: 'a } brace, a { brace, and a \\" quote', ok: 1 };
    expect(parsed(`Result: ${JSON.stringify(tricky)} done`)).toEqual(tricky);
  });

  it('takes the first valid object when the model returns two', () => {
    expect(parsed('{"a":1} and then {"b":2}')).toEqual({ a: 1 });
  });

  it('skips an invalid first candidate and uses the next valid one', () => {
    expect(parsed('{not json at all} then {"ok": true}')).toEqual({ ok: true });
  });

  it('removes a reasoning model\'s <think> block first', () => {
    expect(parsed(`<think>The user wants {"draft": 1} maybe...</think>\n${body}`)).toEqual(object);
    expect(parsed(`<think>still thinking</think>\`\`\`json\n${body}\n\`\`\``)).toEqual(object);
  });

  it('handles nested objects and arrays of objects', () => {
    const outline = { segments: [{ id: 1, tags: ['x'] }, { id: 2, tags: [] }], meta: { deep: { deeper: {} } } };
    expect(parsed(`Result:\n${JSON.stringify(outline)}\nEnd.`)).toEqual(outline);
  });

  it('returns the text unchanged when there is no JSON, so the caller\'s parse fails as before', () => {
    expect(extractJson('I am sorry, I cannot do that.')).toBe('I am sorry, I cannot do that.');
    expect(() => JSON.parse(extractJson('no braces here'))).toThrow(SyntaxError);
    expect(() => JSON.parse(extractJson('{"cut off": [1, 2'))).toThrow(SyntaxError);
  });

  it('copes with empty and non-string input', () => {
    expect(extractJson('')).toBe('');
    expect(extractJson(null)).toBe('');
    expect(extractJson(undefined)).toBe('');
  });
});

describe('schema helpers for providers that cannot enforce a schema', () => {
  it('convert Gemini type names to standard JSON Schema, recursively', () => {
    const converted = toJsonSchema(guestQuestionsResponseSchema);
    expect(converted).toEqual({
      type: 'object',
      properties: { questions: { type: 'array', items: { type: 'string' } } },
      required: ['questions'],
    });
  });

  it('keep descriptions, required lists and nested items', () => {
    const converted = toJsonSchema(outlineResponseSchema);
    expect(converted.properties.segments.items.properties.duration_mins.type).toBe('number');
    expect(converted.properties.intro.description).toMatch(/cold open/);
    expect(converted.required).toContain('episode_title');
    expect(JSON.stringify(converted)).not.toMatch(/"(OBJECT|STRING|NUMBER|ARRAY)"/);
  });

  it('do not modify the original schema', () => {
    const before = JSON.stringify(outlineResponseSchema);
    toJsonSchema(outlineResponseSchema);
    expect(JSON.stringify(outlineResponseSchema)).toBe(before);
  });

  it('build an example with the right shape: one array item, placeholder values', () => {
    expect(exampleFromSchema(guestQuestionsResponseSchema)).toEqual({ questions: ['string'] });
    const example = exampleFromSchema(outlineResponseSchema);
    expect(Object.keys(example)).toEqual(Object.keys(outlineResponseSchema.properties));
    expect(example.segments).toHaveLength(1);
    expect(example.segments[0]).toEqual({ id: 1, title: 'string', talking_points: ['string'], duration_mins: 1, transition: 'string' });
  });
});
