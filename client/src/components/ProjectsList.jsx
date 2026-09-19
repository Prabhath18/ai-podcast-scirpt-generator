import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Spinner from './Spinner.jsx';
import EmptyState from './EmptyState.jsx';
import { api, ApiError } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { relativeTime } from '../utils/relativeTime.js';

export default function ProjectsList({ onClose, onOpenProject }) {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const toast = useToast();

  const load = async () => {
    setError(null);
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

  const commitRename = async (project) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title || title === project.title) return;
    try {
      await api.put(`/api/projects/${project.id}`, { title });
      setProjects((list) => list.map((p) => (p.id === project.id ? { ...p, title } : p)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not rename the project.');
    }
  };

  const handleDelete = async (project) => {
    try {
      await api.delete(`/api/projects/${project.id}`);
      setProjects((list) => list.filter((p) => p.id !== project.id));
      toast.success(`Deleted “${project.title}”.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the project.');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  return (
    <Modal title="My projects" onClose={onClose} maxWidthClass="max-w-lg">
      {projects === null && !error && (
        <div className="flex justify-center py-10 text-ink-muted">
          <Spinner className="h-5 w-5" label="Loading projects" />
        </div>
      )}

      {error && (
        <div className="text-sm text-danger" role="alert">
          <p>{error}</p>
          <button type="button" className="link-action mt-2 !text-danger" onClick={load}>Try again</button>
        </div>
      )}

      {projects && projects.length === 0 && (
        <EmptyState title="Nothing saved yet" description="Generate an outline, then choose Save. It will be waiting here on any device." />
      )}

      {projects && projects.length > 0 && (
        <ul className="scrollbar-thin -mx-1 max-h-[60vh] divide-y divide-line overflow-y-auto border-y border-line">
          {projects.map((project) => (
            <li key={project.id} className="flex items-center gap-3 px-1 py-3">
              <div className="min-w-0 flex-1">
                {renamingId === project.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(project)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setRenamingId(null);
                      }
                    }}
                    className="field"
                    aria-label="Project title"
                  />
                ) : (
                  <button type="button" onClick={() => onOpenProject(project)} className="block w-full text-left">
                    <span className="block truncate font-serif text-base font-semibold">{project.title}</span>
                    <span className="tabular block font-mono text-2xs text-ink-faint">Updated {relativeTime(project.updatedAt)}</span>
                  </button>
                )}
              </div>

              {renamingId !== project.id && (
                <div className="flex shrink-0 items-center gap-3">
                  <button type="button" className="link-action" onClick={() => { setRenamingId(project.id); setRenameValue(project.title); }} aria-label={`Rename ${project.title}`}>
                    Rename
                  </button>
                  {confirmDeleteId === project.id ? (
                    <span className="flex items-center gap-2">
                      <button type="button" className="link-action !text-danger" onClick={() => handleDelete(project)}>Delete</button>
                      <button type="button" className="link-action" onClick={() => setConfirmDeleteId(null)}>Keep</button>
                    </span>
                  ) : (
                    <button type="button" className="link-action" onClick={() => setConfirmDeleteId(project.id)} aria-label={`Delete ${project.title}`}>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-ink-faint">Share links are read-only. Signed-in visitors can comment if you leave comments on.</p>
    </Modal>
  );
}
