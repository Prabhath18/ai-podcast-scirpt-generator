// Shared setup for the component tests: a mocked API and a render that mounts the
// same providers and routes as production. Not a test file (no ".test" in the name).
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App.jsx';
import AppProviders from '../AppProviders.jsx';
import { EMPTY_STATE, reducer } from '../hooks/workspaceReducer.js';

export const USER = { id: 1, email: 'maya@example.com' };

export const OUTLINE = {
  episode_title: 'Mocked Jazz Episode',
  tone: 'Conversational',
  total_duration_mins: 30,
  intro: 'Welcome to the show.',
  segments: Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    title: `Segment ${i + 1} title`,
    talking_points: ['First point', 'Second point', 'Third point'],
    duration_mins: 6,
    transition: 'On to the next.',
  })),
  guest_questions: [],
  outro: 'Thanks for listening.',
};

/** A saved draft: the tech demo loaded into the workspace, as it would sit in localStorage. */
export const draftJson = () => JSON.stringify(reducer(EMPTY_STATE, { type: 'LOAD_DEMO', id: 'tech' }));

/** A generate-outline step that succeeds with a specific outline. */
export const respondWith = (outline) => () => reply(201, { outline });

export const jsonReply = (status, body) => reply(status, body);

export const failWith = (status, code, error = 'Something failed.') => () => reply(status, { error, code });

const reply = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
  });

/**
 * Replaces fetch with a tiny fake server. `signedIn` decides what /api/auth/me
 * says: the user, or the 401 every anonymous visitor gets. Returns the list of
 * "METHOD /path" calls made, so a test can assert on them. With `holdMe`, the
 * /me answer is withheld until `calls.releaseMe()`, to simulate a slow response.
 * `generate` controls POST /api/generate-outline: 'ok' (default), 'hold' (until
 * `calls.releaseGenerate()`), a function returning a Response (custom failure), or an
 * array of those used one per call. `projects` is what GET /api/projects returns. `handlers` adds or overrides routes.
 */
export function mockApi({ signedIn = false, holdMe = false, generate = 'ok', projects = [], handlers = {} } = {}) {
  const calls = [];
  let releaseMe;
  let releaseGenerate;
  const meGate = holdMe ? new Promise((resolve) => (releaseMe = resolve)) : null;
  const generateGate = generate === 'hold' ? new Promise((resolve) => (releaseGenerate = resolve)) : null;
  const generateQueue = Array.isArray(generate) ? [...generate] : null;
  calls.releaseMe = () => releaseMe?.();
  calls.releaseGenerate = () => releaseGenerate?.();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const key = `${init.method || 'GET'} ${new URL(String(url), 'http://localhost').pathname}`;
      calls.push(key);
      switch (key) {
        case 'GET /api/auth/me':
          if (meGate) await meGate;
          return signedIn ? reply(200, { user: USER }) : reply(401, { error: 'You must be logged in to do that.', code: 'UNAUTHENTICATED' });
        case 'POST /api/auth/login':
          return reply(200, { user: USER });
        case 'POST /api/auth/logout':
          return reply(204);
        case 'GET /api/projects':
          return reply(200, { projects });
        case 'POST /api/generate-outline': {
          if (generateGate) await generateGate;
          const step = generateQueue ? generateQueue.shift() ?? 'ok' : generate;
          return typeof step === 'function' ? step() : reply(201, { outline: OUTLINE });
        }
        default:
          // Routes a test adds itself, keyed like the calls list ("POST /api/projects"); a function returns a Response.
          if (handlers[key]) return handlers[key](init);
          return reply(404, { error: `Not mocked: ${key}`, code: 'NOT_FOUND' });
      }
    }),
  );
  return calls;
}

/** Mounts children (default: the whole app) at `path`, with the production providers and a real browser router. */
export function renderAt(path, children = <App />) {
  window.history.replaceState(null, '', path);
  return render(
    <BrowserRouter>
      <AppProviders>{children}</AppProviders>
    </BrowserRouter>,
  );
}

export function resetBrowser() {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
}
