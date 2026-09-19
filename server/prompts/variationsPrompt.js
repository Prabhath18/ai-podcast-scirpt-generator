import { buildContextBlock } from './outlinePrompt.js';

// Suggested structures. The model may pick others, but each variation must
// use a different one -- that is the whole point of asking for variations.
const APPROACHES = [
  'Chronological story: walk through events in the order they happened',
  'Problem and solution: open with the pain point, then build toward fixes',
  'Myth-busting / debate: state common beliefs, then test them against the evidence',
  'Case study led: anchor the episode on one concrete example and widen out',
  'Listener questions: organise around the questions an audience would actually ask',
];

/** One prompt, one call: returns `count` differently structured outlines for the same brief. */
export function buildVariationsPrompt({
  topic,
  tone,
  podcastName,
  hostCount,
  lengthMins,
  includeGuests,
  guestNames,
  guestBio,
  count,
}) {
  const context = buildContextBlock({ topic, tone, podcastName, hostCount, lengthMins });
  const guestLine = includeGuests
    ? `This episode includes a guest: ${guestNames || 'unnamed guest'}${
        guestBio ? ` (${guestBio})` : ''
      }. Every variation needs 5 to 8 tailored interview questions in guest_questions.`
    : 'This episode has no guest. Return an empty array for guest_questions in every variation.';

  return `You are an expert podcast producer. Plan ${count} alternative outlines for the SAME single episode, so the host can compare structures before committing.

${context}

${guestLine}

Return JSON of the form { "variations": [ ... ] } with exactly ${count} items. Each item is a complete outline with:
- approach: a short label (under 6 words) naming its structure
- rationale: one sentence on why this structure suits the topic
- episode_title: a compelling title for this variation
- intro: a 2-4 sentence hook the host can read verbatim
- segments: 5 to 8 segments, each with id (sequential from 1), a specific title, 3 to 5 concrete talking_points, duration_mins (segments should sum to about ${lengthMins}), and a one-line spoken transition
- guest_questions: as instructed above
- outro: a 2-3 sentence wrap-up with a call to action

The variations must differ in STRUCTURE, not just wording: different segment order, different segment titles, a different way of moving through the topic. Use a different one of these approaches for each variation (or a better fit if you have one):
${APPROACHES.map((a) => `- ${a}`).join('\n')}

Keep every talking point specific to "${topic}" and match the ${tone} tone. Return ONLY the JSON object, no commentary.`;
}
