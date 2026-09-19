const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials({ email, password }) {
  const errors = [];
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters.' });
  }
  return { valid: errors.length === 0, errors };
}
