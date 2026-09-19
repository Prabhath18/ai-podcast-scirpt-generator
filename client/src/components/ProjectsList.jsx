import { useEffect, useState } from 'react';
import { FolderOpen, Trash2, Pencil, Check, X as XIcon, Share2, Copy } from 'lucide-react';
import Modal from './Modal.jsx';
import Spinner from './Spinner.jsx';
import EmptyState from './EmptyState.jsx';
import { api, ApiError } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';

function formatDate(iso) {
  try {
    return new Date(`${iso.replace(' ', 'T')}Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function ProjectsList({ onClose, onOpenProject }) {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const toast = useToast();

  const load = async () => {
    try {
      const data = await api.get('/api/projects');
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your projects.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startRename = (project) => {
    setRenamingId(project.id);
    setRenameValue(project.title);
  };

  const commitRename = async (project) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title || title === project.title) return;
    try {
      await api.put(`/api/projects/${project.id}`, { title });
      setProjects((list) => list.map((p) => (p.id === project.id ? { ...p, title } : p)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not rename project.');
    }
  };

  const handleDelete = async (project) => {
    try {
      await api.delete(`/api/projects/${project.id}`);
      setProjects((list) => list.filter((p) => p.id !== project.id));
      toast.success(`Deleted “${project.title}”.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete project.');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleShare = async (project) => {
    try {
      const data = await api.post(`/api/projects/${project.id}/share`);
      const url = `${window.location.origin}/shared/${data.shareToken}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create a share link.');
    }
  };

  return (
    <Modal title="My Projects" onClose={onClose} maxWidthClass="max-w-lg">
      {projects === null && !error && (
        <div className="flex justify-center py-10">
          <Spinner className="w-5 h-5 text-accent" label="Loading projects" />
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {projects && projects.length === 0 && (
        <EmptyState icon={FolderOpen} title="No saved projects yet" description="Generate an outline and click “Save project” to see it here." />
      )}

      {projects && projects.length > 0 && (
        <ul className="space-y-1 max-h-[60vh] overflow-y-auto scrollbar-thin -mx-2">
          {projects.map((project) => (
            <li key={project.id} className="flex items-center gap-2 px-2 py-2.5 rounded-lg hover:bg-surface-sunken group">
              <FolderOpen className="w-4 h-4 text-ink-faint shrink-0" aria-hidden="true" />

              <div className="flex-1 min-w-0">
                {renamingId === project.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(project);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="flex-1 rounded-md border border-accent bg-surface px-2 py-1 text-sm"
                      aria-label="Project title"
                    />
                    <button type="button" onClick={() => commitRename(project)} aria-label="Confirm rename" className="p-1 text-emerald-600">
                      <Check className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setRenamingId(null)} aria-label="Cancel rename" className="p-1 text-ink-faint">
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => onOpenProject(project)} className="text-left w-full">
                    <p className="text-sm font-medium text-ink truncate">{project.title}</p>
                    <p className="text-xs text-ink-faint">Updated {formatDate(project.updatedAt)}</p>
                  </button>
                )}
              </div>

              {renamingId !== project.id && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button type="button" onClick={() => handleShare(project)} aria-label={`Copy share link for ${project.title}`} className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-raised">
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => startRename(project)} aria-label={`Rename ${project.title}`} className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-raised">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {confirmDeleteId === project.id ? (
                    <>
                      <button type="button" onClick={() => handleDelete(project)} className="text-xs font-medium text-red-600 px-1.5">
                        Delete?
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteId(null)} aria-label="Cancel delete" className="p-1.5 text-ink-faint">
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(project.id)}
                      aria-label={`Delete ${project.title}`}
                      className="p-1.5 rounded-md text-ink-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-center gap-1.5 text-xs text-ink-faint mt-4 pt-3 border-t border-border">
        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
        Share links are read-only -- viewers can&apos;t sign in or edit.
      </p>
    </Modal>
  );
}
