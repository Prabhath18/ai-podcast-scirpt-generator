// The app's response schemas are written in Gemini's dialect (type: 'OBJECT', 'STRING', ...)
// because Gemini enforces them. Providers without schema enforcement need the same
// information as plain text in the prompt, in standard JSON Schema form, plus a short
// example to copy. These two helpers produce both from the one schema, so the prompts
// and schemas in prompts/ stay untouched.

/** Gemini-dialect schema -> standard JSON Schema (lowercase type names; everything else kept). */
export function toJsonSchema(node) {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (!node || typeof node !== 'object') return node;

  const converted = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'type' && typeof value === 'string') converted[key] = value.toLowerCase();
    else if (key === 'properties') converted[key] = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, toJsonSchema(child)]));
    else if (key === 'items') converted[key] = toJsonSchema(value);
    else converted[key] = value;
  }
  return converted;
}

/** A small, valid-shaped example value for a schema (one array element, placeholder strings). */
export function exampleFromSchema(node) {
  switch (String(node?.type ?? '').toLowerCase()) {
    case 'object':
      return Object.fromEntries(Object.entries(node.properties ?? {}).map(([name, child]) => [name, exampleFromSchema(child)]));
    case 'array':
      return [exampleFromSchema(node.items ?? { type: 'string' })];
    case 'number':
    case 'integer':
      return 1;
    case 'boolean':
      return true;
    default:
      return 'string';
  }
}
