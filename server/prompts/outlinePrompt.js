// Every field the user supplied is folded into the prompt so the model has
// full context in a single call -- this is the primary defense against tone
// drift called for in the brief, since the *same* context string is reused
// verbatim (see buildContextBlock) by the Deep Dive and guest-question
// prompts too.

const TONE_GUIDANCE = {
  Conversational: 'warm, casual, like two friends chatting -- contractions and asides are welcome',
  Educational: 'clear and structured, defines jargon, builds from basics to nuance',
  Comedic: 'playful and quick, looks for the funny angle without losing the throughline',
  Investigative: 'probing and suspenseful, questions assumptions, follows the evidence',
  Motivational: 'energetic and encouraging, centers actionable takeaways and personal stories',
};

export function buildContextBlock({ topic, tone, podcastName, hostCount, lengthMins }) {
  const toneNote = TONE_GUIDANCE[tone] ? ` (${TONE_GUIDANCE[tone]})` : '';
  const lines = [
    `Podcast topic: ${topic}`,
    `Tone: ${tone}${toneNote}`,
    `Target episode length: ${lengthMins} minutes`,
  ];
  if (podcastName) lines.push(`Podcast name: ${podcastName}`);
  if (hostCount) lines.push(`Number of hosts: ${hostCount}`);
  return lines.join('\n');
}

export function buildOutlinePrompt({
  topic,
  tone,
  podcastName,
  hostCount,
  lengthMins,
  includeGuests,
  guestNames,
  guestBio,
}) {
  const context = buildContextBlock({ topic, tone, podcastName, hostCount, lengthMins });
  const guestLine = includeGuests
    ? `This episode includes a guest: ${guestNames || 'unnamed guest'}${
        guestBio ? ` (${guestBio})` : ''
      }. Weave the guest naturally into at least one segment's talking points and generate 5 to 8 interview questions tailored to the topic and the guest's background for the guest_questions field.`
    : 'This episode has no guest. Return an empty array for guest_questions.';

  return `You are an expert podcast producer helping a creator plan a single episode.

${context}

${guestLine}

Generate a complete episode outline as JSON with this exact structure:
- episode_title: a compelling title for this specific episode
- tone: echo back "${tone}"
- total_duration_mins: echo back ${lengthMins}
- intro: a 2-4 sentence cold open / hook the host(s) can read verbatim
- segments: an array of 5 to 8 segments. Each segment needs:
  - id: a sequential integer starting at 1
  - title: a short, specific segment title (not generic like "Segment 1")
  - talking_points: 3 to 5 concrete, specific bullet points -- names, numbers, examples, or questions to raise, not vague topic labels
  - duration_mins: this segment's share of the ${lengthMins}-minute total (segment durations should sum to approximately ${lengthMins})
  - transition: one natural spoken line bridging to the next segment
- guest_questions: as instructed above
- outro: a 2-3 sentence closing wrap-up with a call to action for listeners

Keep every talking point and question specific to "${topic}" -- avoid generic advice that could apply to any episode. Match the ${tone} tone throughout, including in the intro and outro. Return ONLY the JSON object, no commentary.`;
}
