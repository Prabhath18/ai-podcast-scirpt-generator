// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { mockApi, renderAt, resetBrowser } from './helpers.jsx';
import { WORKSPACE_KEY } from '../services/session.js';

beforeEach(resetBrowser);
afterEach(resetBrowser);

const pathname = () => window.location.pathname;
const TECH_TITLE = 'How AI Coding Assistants Are Rewiring Software Careers';

describe('landing page: anonymous visitor', () => {
  beforeEach(() => mockApi({ signedIn: false }));

  it('offers Get started, Try a demo, Log in and Sign up, and not Open app', async () => {
    renderAt('/');
    await screen.findByRole('button', { name: 'Log in' });
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Get started' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Try a demo' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Open app' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
  });

  it('Get started goes to /app', async () => {
    renderAt('/');
    fireEvent.click((await screen.findAllByRole('link', { name: 'Get started' }))[0]);
    await screen.findByRole('heading', { name: 'Start with the brief' });
    expect(pathname()).toBe('/app');
  });

  it('Try a demo opens /app with the demo loaded, and does not reload it on refresh', async () => {
    const view = renderAt('/');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Try a demo' }))[0]);

    await screen.findAllByText(TECH_TITLE);
    expect(pathname()).toBe('/app');
    expect(window.history.state?.usr ?? null).toBeNull(); // hand-off state is spent
    expect(localStorage.getItem(WORKSPACE_KEY)).not.toBeNull();

    // A refresh: same URL, new page load. The stored draft comes back; the demo is not requested again.
    view.unmount();
    mockApi({ signedIn: false });
    renderAt('/app');
    await screen.findAllByText(TECH_TITLE);
  });

  it('Log in opens the dialog, and a successful login goes to /app', async () => {
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Log in' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: 'maya@example.com' } });
    fireEvent.change(within(dialog).getByLabelText(/Password/), { target: { value: 'password123' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(pathname()).toBe('/app'));
    await screen.findByRole('heading', { name: 'Start with the brief' });
  });

  it('Sign up opens the dialog on the create-account tab', async () => {
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Sign up' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: 'Create account', checked: true })).toBeTruthy();
  });

  it('sends unknown URLs back to "/"', async () => {
    renderAt('/no/such/page');
    await waitFor(() => expect(pathname()).toBe('/'));
    await screen.findByRole('heading', { level: 1, name: /plan the episode/i });
  });
});

describe('landing page: signed-in visitor', () => {
  it('shows Open app and Log out instead of Get started, Log in and Sign up', async () => {
    mockApi({ signedIn: true });
    renderAt('/');

    await screen.findByRole('button', { name: 'Log out' });
    expect(screen.getAllByRole('link', { name: 'Open app' })).toHaveLength(3); // nav, hero, closing call to action
    expect(screen.queryByRole('link', { name: 'Get started' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign up' })).toBeNull();
  });

  it('Log out on the landing page stays on "/" and clears the draft', async () => {
    mockApi({ signedIn: true });
    localStorage.setItem(WORKSPACE_KEY, '{"outline":null}');
    renderAt('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));

    await screen.findByRole('button', { name: 'Log in' });
    expect(pathname()).toBe('/');
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
  });
});

describe('landing page: structure and accessibility', () => {
  beforeEach(() => mockApi({ signedIn: false }));

  it('has the landmarks, one h1, and a skip link', async () => {
    renderAt('/');
    await screen.findByRole('button', { name: 'Log in' });

    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /skip to the content/i }).getAttribute('href')).toBe('#main');
  });

  it('names every section, and the in-page links point at real ids', async () => {
    renderAt('/');
    await screen.findByRole('button', { name: 'Log in' });

    for (const name of ['How it works', 'What you get']) {
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
    for (const link of within(screen.getByRole('navigation', { name: 'Primary' })).getAllByRole('link')) {
      expect(document.querySelector(link.getAttribute('href'))).not.toBeNull();
    }
  });

  it('shows the three steps and all six features', async () => {
    renderAt('/');
    await screen.findByRole('button', { name: 'Log in' });

    const steps = within(screen.getByRole('region', { name: 'How it works' })).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    const features = within(screen.getByRole('region', { name: 'What you get' })).getAllByRole('listitem');
    expect(features).toHaveLength(6);
    for (const title of ['Outline generation', 'Deep Dive notes', 'Guest questions', 'Inline editing', 'Export', 'Saved projects and share links']) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    }
  });

  it('shows a sample outline preview from the bundled demo', async () => {
    renderAt('/');
    await screen.findByRole('button', { name: 'Log in' });

    const figure = screen.getByRole('figure', { name: /sample outline/i });
    expect(within(figure).getByText(TECH_TITLE)).toBeTruthy();
    expect(within(figure).getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });

  it('has no images without alt text, and hides decorative graphics from assistive tech', async () => {
    renderAt('/');
    await screen.findByRole('button', { name: 'Log in' });

    for (const img of document.querySelectorAll('img')) expect(img.getAttribute('alt')).not.toBeNull();
    for (const svg of document.querySelectorAll('svg')) expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
