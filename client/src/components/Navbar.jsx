import { Mic, FolderOpen, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';

export default function Navbar({ onOpenAuth, onOpenProjects }) {
  const { user, isAuthenticated, logout } = useAuth();
  const toast = useToast();

  const handleLogout = async () => {
    await logout();
    toast.success("You're logged out. Your local draft is still saved on this device.");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Mic className="w-4 h-4 text-white" aria-hidden="true" />
          </span>
          <span className="font-semibold text-ink hidden sm:inline">Podcast Outline AI</span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={onOpenProjects}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
              >
                <FolderOpen className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">My Projects</span>
              </button>
              <span className="hidden md:inline text-sm text-ink-faint truncate max-w-[160px]">{user.email}</span>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover transition-colors"
            >
              Log in
            </button>
          )}
          <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
