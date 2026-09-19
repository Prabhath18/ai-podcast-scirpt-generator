// Gemini structured-output (JSON mode) schemas. Kept separate from
// validators/outlineSchema.js: this is what *shapes* the model's response,
// the validator is what *checks* it afterwards (LLM JSON mode reduces but
// does not guarantee schema-perfect output).

export const outlineResponseSchema = {
  type: 'OBJECT',
  properties: {
    episode_title: { type: 'STRING' },
    tone: { type: 'STRING' },
    total_duration_mins: { type: 'NUMBER' },
    intro: { type: 'STRING', description: 'A 2-4 sentence cold open / hook for the host(s) to read.' },
    segments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'NUMBER' },
          title: { type: 'STRING' },
          talking_points: { type: 'ARRAY', items: { type: 'STRING' } },
          duration_mins: { type: 'NUMBER' },
          transition: { type: 'STRING', description: 'One line bridging to the next segment.' },
        },
        required: ['id', 'title', 'talking_points', 'duration_mins', 'transition'],
      },
    },
    guest_questions: { type: 'ARRAY', items: { type: 'STRING' } },
    outro: { type: 'STRING', description: 'A closing wrap-up and call to action.' },
  },
  required: ['episode_title', 'tone', 'total_duration_mins', 'intro', 'segments', 'guest_questions', 'outro'],
};

export const deepDiveResponseSchema = {
  type: 'OBJECT',
  properties: {
    notes: {
      type: 'STRING',
      description: '2-3 paragraphs of research notes, separated by a blank line.',
    },
    discussion_prompts: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['notes', 'discussion_prompts'],
};

export const guestQuestionsResponseSchema = {
  type: 'OBJECT',
  properties: {
    questions: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['questions'],
};
