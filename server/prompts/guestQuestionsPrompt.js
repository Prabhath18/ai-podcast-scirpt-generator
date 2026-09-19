import { buildContextBlock } from './outlinePrompt.js';

/**
 * Used by POST /api/guest-questions to (re)generate a fresh batch of
 * questions independently of the main outline call -- e.g. after the user
 * edits the guest's bio, or just wants different questions.
 */
export function buildGuestQuestionsPrompt({ topic, tone, lengthMins, guestNames, guestBio, outline }) {
  const context = buildContextBlock({ topic, tone, lengthMins });
  const segmentTitles = (outline?.segments || []).map((s) => `- ${s.title}`).join('\n');

  return `You are helping a podcast host prepare interview questions for a guest.

${context}
Guest: ${guestNames || 'unnamed guest'}${guestBio ? `\nGuest background: ${guestBio}` : ''}
${segmentTitles ? `Episode segments, for context:\n${segmentTitles}` : ''}

Generate 5 to 8 interview questions for this guest. They should:
- be specific to "${topic}" and to the guest's background (not generic interview filler)
- move from easier/warm-up questions toward more substantive ones
- match the ${tone} tone
- avoid yes/no phrasing where possible, favoring questions that invite a story or explanation

Return ONLY a JSON object of the form { "questions": string[] }, no commentary.`;
}
