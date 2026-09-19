/** A cheap "content fingerprint" for a segment, used to detect edits that should invalidate a cached Deep Dive. */
export function segmentContentKey(segment) {
  return JSON.stringify({ title: segment.title, talking_points: segment.talking_points });
}
