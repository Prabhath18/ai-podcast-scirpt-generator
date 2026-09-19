// What this browser keeps about a signed-in user, and how to forget it.
//
// WORKSPACE_KEY holds the whole draft: the brief, the outline with its variations
// and pinned sources, cached Deep Dives and guest questions, and which saved
// project is open. Everything derived from a user's work is stored under it, so
// signing out only has to remove the keys listed in USER_DATA_KEYS. Theme and the
// export preference are settings, not user data, and are deliberately kept.
//
// SESSION_HINT_KEY records "this browser has a signed-in session". The server
// answers 401 to /api/auth/me for anonymous visitors too, so a 401 alone must not
// wipe a draft; a 401 while this hint is set means a real session expired. Because
// removing it fires a `storage` event in the user's other tabs, it is also how
// they learn about a sign-out.

export const WORKSPACE_KEY = 'podcast-workspace-v1';
export const SESSION_HINT_KEY = 'podcast-session';
export const USER_DATA_KEYS = [WORKSPACE_KEY];

function safely(action) {
  try {
    return action();
  } catch {
    return undefined; // storage unavailable (private mode, blocked): nothing to clear
  }
}

export function clearUserData() {
  USER_DATA_KEYS.forEach((key) => safely(() => localStorage.removeItem(key)));
}

export const markSignedIn = () => safely(() => localStorage.setItem(SESSION_HINT_KEY, '1'));
export const markSignedOut = () => safely(() => localStorage.removeItem(SESSION_HINT_KEY));
export const wasSignedIn = () => safely(() => localStorage.getItem(SESSION_HINT_KEY) === '1') ?? false;
