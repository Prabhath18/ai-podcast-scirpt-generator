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
