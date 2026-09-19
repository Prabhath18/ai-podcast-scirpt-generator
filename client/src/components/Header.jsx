import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Wordmark from './Wordmark.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import Timeline from './Timeline.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import { relativeTime, nameFromEmail } from '../utils/relativeTime.js';

const STATUS_TONE = { ok: 'text-ok', warn: 'text-warn', quiet: 'text-ink-muted' };

/** What the save indicator should say, and in which tone. */
export function saveStatus({ hasOutline, isAuthenticated, activeProjectId, dirty, savedAt }) {
  if (!hasOutline) return null;
  if (!isAuthenticated) return { text: 'Draft on this device', tone: 'quiet' };
  if (!activeProjectId) return { text: 'Not saved to your account', tone: 'warn' };
  if (dirty) return { text: 'Unsaved changes', tone: 'warn' };
  return { text: savedAt ? `Saved ${relativeTime(savedAt)}` : 'Saved', tone: 'ok' };
}

export default function Header({ status, timeline, onOpenAuth, onOpenProjects, onOpenShortcuts, note }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    toast.success('Logged out. The draft on this device was cleared.');
  };

  const items = isAuthenticated
    ? [
        onOpenProjects && { label: 'My episodes', onClick: onOpenProjects },
        { label: 'Log out', onClick: handleLogout },
      ]
    : [onOpenAuth && { label: 'Log in', onClick: onOpenAuth, primary: true }];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <div className="mx-auto flex h-12 max-w-[1180px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" aria-label="Podcast Outline AI, home" className="rounded-sm">
          <Wordmark />
        </Link>

        <div className="flex items-center gap-1">
          {status && <p className={`tabular hidden font-mono text-2xs sm:block ${STATUS_TONE[status.tone]}`} role="status">{status.text}</p>}

          {/* Wide screens: actions inline. */}
          <div className="ml-2 hidden items-center gap-1 sm:flex">
            {items.filter(Boolean).map((item) => (
              <button key={item.label} type="button" onClick={item.onClick} className={`btn ${item.primary ? 'btn-primary' : 'btn-quiet'}`}>
                {item.label}
              </button>
            ))}
            {isAuthenticated && <span className="hidden max-w-[10rem] truncate text-xs text-ink-faint lg:inline">{nameFromEmail(user.email)}</span>}
            {onOpenShortcuts && (
              <button type="button" onClick={onOpenShortcuts} aria-label="Keyboard shortcuts" className="btn btn-quiet hidden h-8 w-8 px-0 font-mono lg:inline-flex">
                ?
              </button>
            )}
            <ThemeToggle />
          </div>

          {/* Phones: one Menu button. */}
          <div className="relative sm:hidden" ref={menuRef}>
            <button type="button" className="btn btn-quiet" aria-expanded={menuOpen} aria-haspopup="true" onClick={() => setMenuOpen((o) => !o)}>
              Menu
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-40 mt-1 w-52 animate-fade-in rounded-lg border border-line-strong bg-page py-1 shadow-float">
                {status && <p className={`tabular px-3 py-2 font-mono text-2xs ${STATUS_TONE[status.tone]}`}>{status.text}</p>}
                {items.filter(Boolean).map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      item.onClick();
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-sunken"
                  >
                    {item.label}
                  </button>
                ))}
                <button type="button" onClick={toggleTheme} className="block w-full px-3 py-2 text-left text-sm hover:bg-sunken">
                  {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {note && (
        <p className="mx-auto max-w-[1180px] border-t border-line px-4 py-1.5 text-xs text-ink-muted sm:px-6">{note}</p>
      )}
      {timeline && <Timeline {...timeline} />}
    </header>
  );
}
