// Input validation for the LLM-backed endpoints. Separate from
// outlineSchema.js, which validates the *response* shape -- this validates
// what the *client sent us* before we spend an LLM call on it.

const HOST_COUNTS = ['solo', 'duo', 'group'];

export function validateOutlineRequest(body) {
  const errors = [];
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const tone = typeof body.tone === 'string' ? body.tone.trim() : '';

  if (!topic) {
    errors.push({ field: 'topic', message: 'Topic is required.' });
  } else if (topic.length > 300) {
    errors.push({ field: 'topic', message: 'Topic must be 300 characters or fewer.' });
  }

  if (!tone) {
    errors.push({ field: 'tone', message: 'Tone is required.' });
  } else if (tone.length > 60) {
    errors.push({ field: 'tone', message: 'Tone must be 60 characters or fewer.' });
  }

  const lengthMins = Number(body.lengthMins);
  if (!Number.isFinite(lengthMins) || lengthMins < 5 || lengthMins > 180) {
    errors.push({ field: 'lengthMins', message: 'Target length must be between 5 and 180 minutes.' });
  }

  if (body.hostCount && !HOST_COUNTS.includes(body.hostCount)) {
    errors.push({ field: 'hostCount', message: `hostCount must be one of: ${HOST_COUNTS.join(', ')}.` });
  }

  if (body.includeGuests && typeof body.guestNames === 'string' && body.guestNames.length > 200) {
    errors.push({ field: 'guestNames', message: 'Guest names must be 200 characters or fewer.' });
  }
  if (body.includeGuests && typeof body.guestBio === 'string' && body.guestBio.length > 1000) {
    errors.push({ field: 'guestBio', message: 'Guest bio must be 1000 characters or fewer.' });
  }

  return { valid: errors.length === 0, errors };
}

export function validateExpandSegmentRequest(body) {
  const errors = [];
  if (!body.topic || typeof body.topic !== 'string') {
    errors.push({ field: 'topic', message: 'topic is required.' });
  }
  if (!body.tone || typeof body.tone !== 'string') {
    errors.push({ field: 'tone', message: 'tone is required.' });
  }
  if (!body.segment || typeof body.segment !== 'object') {
    errors.push({ field: 'segment', message: 'segment is required.' });
  } else {
    if (typeof body.segment.title !== 'string' || !body.segment.title.trim()) {
      errors.push({ field: 'segment.title', message: 'segment.title is required.' });
    }
    if (!Array.isArray(body.segment.talking_points)) {
      errors.push({ field: 'segment.talking_points', message: 'segment.talking_points must be an array.' });
    }
  }
  if (!body.outline || !Array.isArray(body.outline.segments)) {
    errors.push({ field: 'outline', message: 'outline with segments is required for context.' });
  }
  return { valid: errors.length === 0, errors };
}

export function validateGuestQuestionsRequest(body) {
  const errors = [];
  if (!body.topic || typeof body.topic !== 'string') {
    errors.push({ field: 'topic', message: 'topic is required.' });
  }
  if (!body.tone || typeof body.tone !== 'string') {
    errors.push({ field: 'tone', message: 'tone is required.' });
  }
  if (body.guestBio && typeof body.guestBio !== 'string') {
    errors.push({ field: 'guestBio', message: 'guestBio must be a string.' });
  }
  return { valid: errors.length === 0, errors };
}


export function validateVariationsRequest(body) {
  const base = validateOutlineRequest(body);
  const errors = [...base.errors];
  const count = Number(body.count);
  if (count !== 2 && count !== 3) {
    errors.push({ field: 'count', message: 'count must be 2 or 3.' });
  }
  return { valid: errors.length === 0, errors };
}

export function validateIntroOutroRequest(body) {
  const errors = [];
  if (!body.topic || typeof body.topic !== 'string') {
    errors.push({ field: 'topic', message: 'topic is required.' });
  }
  if (!body.tone || typeof body.tone !== 'string') {
    errors.push({ field: 'tone', message: 'tone is required.' });
  }
  if (body.hostCount && !HOST_COUNTS.includes(body.hostCount)) {
    errors.push({ field: 'hostCount', message: `hostCount must be one of: ${HOST_COUNTS.join(', ')}.` });
  }
  if (!body.outline || !Array.isArray(body.outline.segments)) {
    errors.push({ field: 'outline', message: 'outline with segments is required for context.' });
  }
  return { valid: errors.length === 0, errors };
}

export function validateResearchRequest(body) {
  const errors = [];
  if (typeof body.topic !== 'string' || !body.topic.trim() || body.topic.length > 300) {
    errors.push({ field: 'topic', message: 'topic is required (300 characters or fewer).' });
  }
  if (body.segmentTitle !== undefined && (typeof body.segmentTitle !== 'string' || body.segmentTitle.length > 200)) {
    errors.push({ field: 'segmentTitle', message: 'segmentTitle must be a string of 200 characters or fewer.' });
  }
  return { valid: errors.length === 0, errors };
}
