import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../services/api.js';
import { SESSION_HINT_KEY, clearUserData, markSignedIn, markSignedOut, wasSignedIn } from '../services/session.js';
import { useToast } from './useToast.jsx';

const AuthContext = createContext(null);

const onWorkspacePage = () => window.location.pathname.startsWith('/app');

/**
 * Who is signed in, and what happens when that ends. Every way a session can end
 * (logout, an expired session found on load, a sign-out in another tab) goes
 * through one path that forgets the user's local data, bumps `sessionEpoch`
 * (which resets any mounted workspace) and, on the workspace page, returns to the
 * landing page with `replace` so Back cannot show the old outline.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const toast = useToast();
  // useNavigate() returns a new function on every route change; a ref keeps endSession
  // (and the effects below that depend on it) stable so /me is not re-fetched per page.
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const userRef = useRef(null);
  userRef.current = user;
  // Bumped whenever the session changes on purpose (login, signup, sign-out). A /me answer that
  // was requested before such a change describes the old session and must be ignored, or a
  // slow 401 arriving just after a fast login would sign the user straight back out.
  const generation = useRef(0);

  const endSession = useCallback(
    ({ goHome }) => {
      generation.current += 1;
      clearUserData();
      markSignedOut();
      setUser(null);
      setSessionEpoch((n) => n + 1);
      if (goHome) navigateRef.current('/', { replace: true });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const requestedAt = generation.current;
    const stale = () => cancelled || generation.current !== requestedAt;
    api
      .get('/api/auth/me')
      .then((data) => {
        if (stale()) return;
        markSignedIn();
        setUser(data.user);
      })
      .catch((err) => {
        if (stale()) return;
        setUser(null);
        // A 401 is normal for an anonymous visitor and must keep their draft.
        // It only means "expired" if this browser had a signed-in session.
        if (err instanceof ApiError && err.code === 'UNAUTHENTICATED' && wasSignedIn()) {
          endSession({ goHome: onWorkspacePage() });
          toast.info('Your session expired. Log in again to reach your saved projects.');
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endSession, toast]);

  // Another tab signed out (or in). `storage` only fires in the *other* tabs.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== SESSION_HINT_KEY && event.key !== null) return; // null = storage was cleared
      if (!wasSignedIn() && userRef.current) {
        endSession({ goHome: onWorkspacePage() });
        toast.info('You were logged out in another tab.');
      } else if (wasSignedIn() && !userRef.current) {
        api.get('/api/auth/me').then((data) => setUser(data.user)).catch(() => {});
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [endSession, toast]);

  const signup = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/signup', { email, password });
    generation.current += 1;
    markSignedIn();
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password });
    generation.current += 1;
    markSignedIn();
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      // Even if the server can't be reached, this device must forget the user.
      if (!(err instanceof ApiError)) throw err;
    } finally {
      endSession({ goHome: true });
    }
  }, [endSession]);

  return (
    <AuthContext.Provider value={{ user, checking, sessionEpoch, signup, login, logout, isAuthenticated: Boolean(user) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
