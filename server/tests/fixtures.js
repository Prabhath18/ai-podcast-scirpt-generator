export function sampleOutline(overrides = {}) {
  return {
    episode_title: 'A Great Episode',
    tone: 'Conversational',
    total_duration_mins: 25,
    intro: 'Welcome!',
    segments: Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      title: `Segment ${i + 1}`,
      talking_points: ['Point one', 'Point two', 'Point three'],
      duration_mins: 5,
      transition: 'Next up...',
    })),
    guest_questions: [],
    outro: 'Thanks for listening!',
    ...overrides,
  };
}

export function sampleVariation(approach = 'Chronological story', overrides = {}) {
  return {
    approach,
    rationale: 'Suits the topic because it builds in order.',
    outline: sampleOutline({ episode_title: `Episode: ${approach}` }),
    ...overrides,
  };
}

/** A raw LLM "variations" item: the shape the model returns, before the server assembles it. */
export function rawVariation(approach, overrides = {}) {
  const { episode_title, intro, segments, outro } = sampleOutline({ episode_title: `Episode: ${approach}` });
  return { approach, rationale: 'A sensible way in.', episode_title, intro, segments, guest_questions: [], outro, ...overrides };
}
