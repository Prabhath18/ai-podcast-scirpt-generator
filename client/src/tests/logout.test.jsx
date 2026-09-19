// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { OUTLINE, draftJson, mockApi, renderAt, resetBrowser } from './helpers.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useOutlineWorkspace } from '../hooks/useOutlineWorkspace.js';
import { SESSION_HINT_KEY, WORKSPACE_KEY } from '../services/session.js';

beforeEach(resetBrowser);
afterEach(resetBrowser);

const pathname = () => window.location.pathname;

describe('logging out', () => {
  it('generates an outline, logs out, and leaves no state, no stored draft, and the route at "/"', async () => {
    mockApi({ signedIn: true });
    // Probe stays mounted across the logout, so this checks the in-memory reset itself,
    // not just "the page unmounted and the next visit started empty".
    const seen = {};
    function Probe() {
      seen.workspace = useOutlineWorkspace();
      seen.auth = useAuth();
      return null;
    }
    renderAt('/app', <Probe />);
    await waitFor(() => expect(seen.auth.isAuthenticated).toBe(true));

    await act(async () => {
      await seen.workspace.generate();
    });
    act(() => {
      seen.workspace.setActiveProject(5, 'share-token');
      seen.workspace.setDeepDive(1, 'snapshot', { notes: 'Some notes', discussion_prompts: [] });
    });
    expect(seen.workspace.outline.episode_title).toBe(OUTLINE.episode_title);
    expect(seen.workspace.activeProjectId).toBe(5);
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)).outline.episode_title).toBe(OUTLINE.episode_title);
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');

    await act(async () => {
      await seen.auth.logout();
    });

    expect(seen.workspace.outline).toBeNull();
    expect(seen.workspace.activeProjectId).toBeNull();
    expect(seen.workspace.shareToken).toBeNull();
    expect(seen.workspace.getDeepDive(OUTLINE.segments[0])).toBeNull();
    expect(seen.workspace.form.topic).toBe('');
    expect(seen.auth.isAuthenticated).toBe(false);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
    // Only settings survive a logout (the theme); nothing about the user's work does.
    expect(Object.keys(localStorage).filter((key) => key !== 'podcast-theme')).toEqual([]);
    expect(pathname()).toBe('/');
  });

  it('from the real app: lands on "/", replaces the history entry, and the next visit to /app is empty', async () => {
    mockApi({ signedIn: true });
    renderAt('/app');

    await screen.findByRole('button', { name: 'Log out' });
    fireEvent.change(screen.getByLabelText(/Topic/), { target: { value: 'Jazz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate outline' }));
    await screen.findByText(OUTLINE.episode_title);
    expect(localStorage.getItem(WORKSPACE_KEY)).not.toBeNull();

    const entriesBefore = window.history.length;
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(pathname()).toBe('/'));
    await screen.findByRole('heading', { level: 1, name: /plan the episode/i });
    expect(window.history.length).toBe(entriesBefore); // replace, not push: Back cannot return to the outline
    expect(screen.queryByText(OUTLINE.episode_title)).toBeNull();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();

    fireEvent.click(screen.getAllByRole('link', { name: 'Get started' })[0]);
    await screen.findByRole('heading', { name: 'Start with the brief' });
    expect(screen.getByLabelText(/Topic/).value).toBe('');
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull(); // opening an empty workspace does not write one
  });

  it('still forgets everything when the server cannot be reached', async () => {
    mockApi({ signedIn: true });
    localStorage.setItem(WORKSPACE_KEY, draftJson());
    const seen = {};
    function Probe() {
      seen.auth = useAuth();
      return null;
    }
    renderAt('/app', <Probe />);
    await waitFor(() => expect(seen.auth.isAuthenticated).toBe(true));

    globalThis.fetch.mockImplementation(async () => {
      throw new TypeError('network down');
    });
    await act(async () => {
      await seen.auth.logout();
    });

    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
    expect(pathname()).toBe('/');
  });
});

describe('expired sessions', () => {
  it('clears the draft and goes to "/" when /me says 401 for a browser that had a session', async () => {
    mockApi({ signedIn: false });
    localStorage.setItem(WORKSPACE_KEY, draftJson());
    localStorage.setItem(SESSION_HINT_KEY, '1');

    renderAt('/app');

    await waitFor(() => expect(pathname()).toBe('/'));
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
    await screen.findByText(/session expired/i);
  });

  it('keeps an anonymous visitor\'s draft: a 401 from /me alone is not an expiry', async () => {
    mockApi({ signedIn: false });
    localStorage.setItem(WORKSPACE_KEY, draftJson()); // no session hint: never signed in here

    renderAt('/app');

    await screen.findAllByText(/How AI Coding Assistants Are Rewiring Software Careers/);
    expect(pathname()).toBe('/app');
    expect(localStorage.getItem(WORKSPACE_KEY)).not.toBeNull();
  });
});

describe('a slow /me response', () => {
  it('does not sign out (or wipe the draft of) someone who logged in while it was still pending', async () => {
    const calls = mockApi({ signedIn: false, holdMe: true });
    localStorage.setItem(WORKSPACE_KEY, draftJson());
    const seen = {};
    function Probe() {
      seen.auth = useAuth();
      return null;
    }
    renderAt('/app', <Probe />);

    // The user logs in before the first /me answer has come back...
    await act(async () => {
      await seen.auth.login('maya@example.com', 'password123');
    });
    expect(seen.auth.isAuthenticated).toBe(true);
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');

    // ...and then that stale 401 arrives. It describes the session from before the login.
    await act(async () => {
      calls.releaseMe();
    });
    await waitFor(() => expect(seen.auth.checking).toBe(false));

    expect(seen.auth.isAuthenticated).toBe(true);
    expect(localStorage.getItem(WORKSPACE_KEY)).not.toBeNull();
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');
    expect(pathname()).toBe('/app');
  });
});

describe('other tabs', () => {
  const storageEvent = (key, newValue) =>
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue, oldValue: newValue === null ? '1' : null }));
    });

  it('signing out in another tab resets this one and sends it to "/"', async () => {
    mockApi({ signedIn: true });
    localStorage.setItem(WORKSPACE_KEY, draftJson());
    localStorage.setItem(SESSION_HINT_KEY, '1');
    renderAt('/app');
    await screen.findByRole('button', { name: 'Log out' });

    // What the other tab did before this tab heard about it.
    localStorage.removeItem(SESSION_HINT_KEY);
    localStorage.removeItem(WORKSPACE_KEY);
    storageEvent(SESSION_HINT_KEY, null);

    await waitFor(() => expect(pathname()).toBe('/'));
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
    await screen.findByText(/logged out in another tab/i);
  });

  it('ignores storage changes that are not about the session', async () => {
    mockApi({ signedIn: true });
    localStorage.setItem(SESSION_HINT_KEY, '1');
    renderAt('/app');
    await screen.findByRole('button', { name: 'Log out' });

    storageEvent('podcast-theme', 'dark');

    expect(pathname()).toBe('/app');
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
  });

  it('signing in in another tab signs this one in too', async () => {
    const calls = mockApi({ signedIn: false });
    renderAt('/app');
    await screen.findByRole('button', { name: 'Log in' });

    mockApi({ signedIn: true });
    localStorage.setItem(SESSION_HINT_KEY, '1');
    storageEvent(SESSION_HINT_KEY, '1');

    await screen.findByRole('button', { name: 'Log out' });
    expect(calls.filter((c) => c === 'GET /api/auth/me')).toHaveLength(1);
  });
});
