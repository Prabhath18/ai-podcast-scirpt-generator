import { useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import TopicForm from '../components/TopicForm.jsx';
import OutlineDisplay from '../components/OutlineDisplay.jsx';
import DeepDivePanel from '../components/DeepDivePanel.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { OutlineSkeleton } from '../components/SkeletonLoader.jsx';
import AuthModal from '../components/AuthModal.jsx';
import ProjectsList from '../components/ProjectsList.jsx';
import Modal from '../components/Modal.jsx';
import { Mic2 } from 'lucide-react';
import { useOutlineWorkspace } from '../hooks/useOutlineWorkspace.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { api, ApiError } from '../services/api.js';

export default function WorkspacePage() {
  const workspace = useOutlineWorkspace();
  const { outline, activeProjectId, shareToken, setActiveProject, setShareToken, loadProject } = workspace;
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const [activeSegmentId, setActiveSegmentId] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [importPromptOpen, setImportPromptOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const activeSegment = outline?.segments.find((s) => s.id === activeSegmentId) || null;

  const handleExpandSegment = (segment) => setActiveSegmentId(segment.id);
  const closeDeepDive = () => setActiveSegmentId(null);

  const persistProject = async () => {
    if (activeProjectId) {
      await api.put(`/api/projects/${activeProjectId}`, { outline });
      return activeProjectId;
    }
    const data = await api.post('/api/projects', { title: outline.episode_title, outline });
    setActiveProject(data.project.id, data.project.shareToken);
    return data.project.id;
  };

  const handleSaveProject = async () => {
    if (!isAuthenticated) {
      toast.info('Log in to save projects across devices.');
      setAuthModalOpen(true);
      return;
    }
    setSaving(true);
    try {
      await persistProject();
      toast.success('Project saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save project.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!isAuthenticated) {
      toast.info('Log in to create a share link.');
      setAuthModalOpen(true);
      return;
    }
    setSharing(true);
    try {
      const id = await persistProject();
      const data = await api.post(`/api/projects/${id}/share`);
      setShareToken(data.shareToken);
      const url = `${window.location.origin}/shared/${data.shareToken}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create a share link.');
    } finally {
      setSharing(false);
    }
  };

  const handleAuthSuccess = () => {
    setAuthModalOpen(false);
    if (outline && !activeProjectId) {
      setImportPromptOpen(true);
    }
  };

  const handleImportConfirm = async () => {
    setImportPromptOpen(false);
    setSaving(true);
    try {
      await persistProject();
      toast.success('Your local outline was saved to your account.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not import your local outline.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenProject = (project) => {
    loadProject(project);
    setActiveSegmentId(null);
    setProjectsModalOpen(false);
    toast.success(`Opened “${project.title}”.`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onOpenAuth={() => setAuthModalOpen(true)} onOpenProjects={() => setProjectsModalOpen(true)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <div className="space-y-5 min-w-0">
            <TopicForm workspace={workspace} collapsedByDefault={Boolean(outline)} onGeneratingChange={setGenerating} />

            {generating && <OutlineSkeleton />}

            {!outline && !generating && (
              <EmptyState
                icon={Mic2}
                title="No outline yet"
                description="Fill in your episode details above and generate an outline, or try a bundled demo to see the app in action."
              />
            )}

            {outline && (
              <OutlineDisplay
                workspace={workspace}
                activeSegmentId={activeSegmentId}
                onExpandSegment={handleExpandSegment}
                onSaveProject={handleSaveProject}
                saving={saving}
                onShare={handleShare}
                sharing={sharing}
                isReadOnly={false}
              />
            )}
          </div>

          {isDesktop && (
            <div className="sticky top-20 h-[calc(100vh-6rem)]">
              <DeepDivePanel activeSegment={activeSegment} workspace={workspace} showCloseButton={false} />
            </div>
          )}
        </div>
      </main>

      {!isDesktop && activeSegment && (
        <div className="fixed inset-0 z-40 flex items-end" role="presentation">
          <div className="absolute inset-0 bg-ink/40" onClick={closeDeepDive} aria-hidden="true" />
          <div className="relative w-full max-h-[85vh] rounded-t-2xl overflow-hidden animate-slide-in-right">
            <DeepDivePanel activeSegment={activeSegment} workspace={workspace} onClose={closeDeepDive} showCloseButton />
          </div>
        </div>
      )}

      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} onSuccess={handleAuthSuccess} />}
      {projectsModalOpen && <ProjectsList onClose={() => setProjectsModalOpen(false)} onOpenProject={handleOpenProject} />}

      {importPromptOpen && (
        <Modal title="Import your local outline?" onClose={() => setImportPromptOpen(false)}>
          <p className="text-sm text-ink-muted mb-5">
            You have an outline saved on this device that isn&apos;t linked to your account yet. Save it as a project now so you can access
            it from anywhere?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setImportPromptOpen(false)}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted hover:bg-surface-sunken"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={handleImportConfirm}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover"
            >
              Import
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
