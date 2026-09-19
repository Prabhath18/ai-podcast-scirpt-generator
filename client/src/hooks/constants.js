// Mirrors server/validators/outlineSchema.js's OUTLINE_LIMITS. Duplicated
// rather than shared across the client/server workspace boundary -- see
// REQUIREMENTS.md for why that tradeoff was made.
export const OUTLINE_LIMITS = {
  MIN_SEGMENTS: 5,
  MAX_SEGMENTS: 8,
  MIN_TALKING_POINTS: 3,
  MAX_TALKING_POINTS: 5,
};

export const TONES = ['Conversational', 'Educational', 'Comedic', 'Investigative', 'Motivational'];

export const HOST_COUNTS = [
  { value: 'solo', label: 'Solo' },
  { value: 'duo', label: 'Duo' },
  { value: 'group', label: 'Group' },
];
