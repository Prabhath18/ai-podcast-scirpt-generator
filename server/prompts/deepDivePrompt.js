import { buildContextBlock } from './outlinePrompt.js';

/**
 * The Deep Dive call receives the topic, tone, and the FULL outline (not
 * just the one segment) so the research notes stay consistent with
 * segments the listener has already heard and won't repeat -- per the
 * brief's "keep the outline coherent across multiple LLM calls" tip.
 */
export function buildDeepDivePrompt({ topic, tone, lengthMins, outline, segment }) {
  const context = buildContextBlock({ topic, tone, lengthMins });
  const otherSegments = outline.segments
    .filter((s) => s.id !== segment.id)
    .map((s) => `- ${s.title}`)
    .join('\n');

  return `You are helping a podcast host prepare deeper research for one segment of an already-planned episode.

${context}
Full episode segment list (for context, so you don't repeat what other segments already cover):
${otherSegments || '(this is the only segment)'}

Now go deep on this specific segment:
Title: ${segment.title}
Talking points already planned: ${segment.talking_points.join('; ')}

Write:
- notes: 2 to 3 paragraphs (separated by a blank line) of detailed research notes for the host -- concrete facts, examples, stats, or angles they could bring up. Do not restate the talking points verbatim; add depth beyond them.
- discussion_prompts: 3 to 5 follow-up questions or prompts the host could use to keep the conversation going if it stalls during this segment.

Stay specific to "${topic}" and keep the ${tone} tone. Return ONLY the JSON object, no commentary.`;
}
