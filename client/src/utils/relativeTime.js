/** SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker; make it an unambiguous ISO string. */
function parseUtc(value) {
  if (value instanceof Date) return value;
  const text = String(value);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text.replace(' ', 'T')}Z`);
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a short date. */
export function relativeTime(value, now = Date.now()) {
  const date = parseUtc(value);
  const seconds = Math.round((now - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return '';
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function nameFromEmail(email) {
  return String(email || 'you').split('@')[0];
}
