import { useEffect, useMemo, useRef, useState } from 'react';
import Header, { saveStatus } from '../components/Header.jsx';
import BriefForm from '../components/BriefForm.jsx';
import OutlineDocument from '../components/OutlineDocument.jsx';
import VariationsView from '../components/VariationsView.jsx';
import IntroOutroView from '../components/IntroOutroView.jsx';
import SidePanel, { PanelSheet } from '../components/SidePanel.jsx';
import DeepDivePanel from '../components/DeepDivePanel.jsx';
import ResearchPanel from '../components/ResearchPanel.jsx';
import CommentsPanel from '../components/CommentsPanel.jsx';
import ExportMenu from '../components/ExportMenu.jsx';
import ShareDialog from '../components/ShareDialog.jsx';
import ShortcutsSheet from '../components/ShortcutsSheet.jsx';
import AuthModal from '../components/AuthModal.jsx';
import ProjectsList from '../components/ProjectsList.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import Tabs, { useTabIds } from '../components/Tabs.jsx';
import { OutlineSkeleton } from '../components/Skeletons.jsx';
import { useOutlineWorkspace } from '../hooks/useOutlineWorkspace.js';
import { useComments, openCountsBySegment } from '../hooks/useComments.js';
import { useHotkeys } from '../hooks/useHotkeys.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { api, ApiError } from '../services/api.js';

const PANEL_TABS = [
  { id: 'deep', label: 'Deep Dive' },
  { id: 'research', label: 'Research' },
];

export default function WorkspacePage() {
  const workspace = useOutlineWorkspace();
  const { outline, form, activeProjectId, dirty, savedAt, demoId, setActiveProject, loadProject, markSaved } = workspace;
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const viewIds = useTabIds();

  const [view, setView] = useState('outline'); // outline | variations | intro
  const [activeSegmentId, setActiveSegmentId] = useState(null);
  const [panelTab, setPanelTab] = useState('deep');
  const [researchScope, setResearchScope] = useState('topic');
  const [commentScope, setCommentScope] = useState('episode');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [panelFocus, setPanelFocus] = useState(0);
  const [deepDiveRequest, setDeepDiveRequest] = useState(0);
  const [briefFocus, setBriefFocus] = useState(0);
  const [modal, setModal] = useState(null); // auth | projects | share | shortcuts | import
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const opener = useRef(null);

  const segments = outline?.segments ?? [];
  const activeIndex = segments.findIndex((s) => s.id === activeSegmentId);
  const activeSegment = activeIndex >= 0 ? segments[activeIndex] : null;

  // --- Comments: the owner's saved project, or the demo's local samples -----
  const commentMode = isAuthenticated && activeProjectId ? 'owner' : demoId ? 'local' : 'none';
  const commentsPanelOpen = panelTab === 'comments' && (isDesktop || sheetOpen);
  const comments = useComments({
    mode: commentMode,
    projectId: activeProjectId,
    enabled: Boolean(outline),
    polling: commentsPanelOpen,
    refreshSignal: panelFocus,
    user,
    workspace,
  });
  const openCounts = useMemo(() => openCountsBySegment(comments.comments), [comments.comments]);
  const totalOpen = comments.comments.filter((c) => !c.resolved).length;
  const commentsUnavailable = commentMode !== 'none' ? null : isAuthenticated ? 'unsaved' : 'login';

  const panelTabs = [...PANEL_TABS, { id: 'comments', label: 'Comments', count: totalOpen }];
  const effectiveResearchScope = activeSegment ? researchScope : 'topic';
  const effectiveCommentScope = !activeSegment && commentScope === 'segment' ? 'episode' : commentScope;

  useEffect(() => {
    document.title = outline ? `${outline.episode_title} · Podcast Outline AI` : 'Podcast Outline AI';
  }, [outline?.episode_title]); // eslint-disable-line react-hooks/exhaustive-deps -- only the title matters

  // --- Panel: opened from a segment's actions or the E / R / C shortcuts -----
  const openPanel = (tab, segmentId) => {
    opener.current = document.activeElement;
    if (segmentId != null) {
      setActiveSegmentId(segmentId);
      setResearchScope('segment');
      setCommentScope('segment');
    }
    setPanelTab(tab);
    setPanelFocus((n) => n + 1);
    if (tab === 'deep') setDeepDiveRequest(1);
    if (!isDesktop) setSheetOpen(true);
  };

  const closePanel = () => {
    setSheetOpen(false);
    if (isDesktop && opener.current && document.contains(opener.current)) opener.current.focus();
  };

  const moveSelection = (step) => {
    if (segments.length === 0) return;
    const next = segments[Math.min(Math.max((activeIndex < 0 ? (step > 0 ? -1 : segments.length) : activeIndex) + step, 0), segments.length - 1)];
    setActiveSegmentId(next.id);
    setAnnouncement(`Segment ${segments.indexOf(next) + 1} of ${segments.length}: ${next.title}`);
    document.getElementById(`segment-${next.id}`)?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const openFor = (tab) => {
    const target = activeSegment ?? segments[0];
    if (target) openPanel(tab, target.id);
  };

  // --- Saving and sharing ---------------------------------------------------
  const persistProject = async () => {
    const data = activeProjectId
      ? await api.put(`/api/projects/${activeProjectId}`, { outline })
      : await api.post('/api/projects', { title: outline.episode_title, outline });
    if (!activeProjectId) setActiveProject(data.project.id, data.project.shareToken);
    markSaved(data.project.updatedAt);
    return data.project.id;
  };

  const handleSave = async () => {
    if (!outline || saving) return;
    if (!isAuthenticated) {
      toast.info('Log in to save this to your account. Your draft is already kept on this device.');
      setModal('auth');
      return;
    }
    setSaving(true);
    try {
      await persistProject();
      toast.success('Saved to your account.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save. Your draft is safe on this device.', { action: { label: 'Try again', onClick: handleSave } });
    } finally {
      setSaving(false);
    }
  };

  const handleShare = () => {
    if (!isAuthenticated) {
      toast.info('Log in to create a share link.');
      setModal('auth');
      return;
    }
    setModal('share');
  };

  const handleAuthSuccess = () => {
    setModal(outline && !activeProjectId ? 'import' : null);
  };

  const handleImportConfirm = async () => {
    setModal(null);
    setSaving(true);
    try {
      await persistProject();
      toast.success('Your draft is now saved to your account.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not import your draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenProject = (project) => {
    loadProject(project);
    setActiveSegmentId(null);
    setView('outline');
    setModal(null);
    toast.success(`Opened “${project.title}”.`);
  };

  const handleGenerated = (result) => {
    setActiveSegmentId(null);
    setView(result.variations > 0 ? 'variations' : 'outline');
  };

  const editBrief = () => {
    setView('outline');
    setBriefFocus((n) => n + 1);
  };

  useHotkeys({
    '/': editBrief,
    '?': () => setModal('shortcuts'),
    e: () => openFor('deep'),
    r: () => openFor('research'),
    c: () => openFor('comments'),
    j: () => moveSelection(1),
    k: () => moveSelection(-1),
    'mod+s': handleSave,
    escape: () => {
      if (sheetOpen) closePanel();
      else if (document.activeElement?.closest('[data-side-panel]')) closePanel();
    },
  });

  // --- Panel bodies -----------------------------------------------------------
  const renderPanel = (tab) => {
    if (tab === 'deep') return <DeepDivePanel segment={activeSegment} workspace={workspace} requestId={deepDiveRequest} onRequestHandled={() => setDeepDiveRequest(0)} />;
    if (tab === 'research') return <ResearchPanel workspace={workspace} segment={activeSegment} scope={effectiveResearchScope} onScopeChange={setResearchScope} />;
    return (
      <CommentsPanel
        comments={comments}
        segment={activeSegment}
        segments={segments}
        scope={effectiveCommentScope}
        onScopeChange={setCommentScope}
        isOwner
        canPost={commentMode !== 'none'}
        unavailable={commentsUnavailable}
        onLogin={() => setModal('auth')}
      />
    );
  };

  const sidePanel = (onClose) => (
    <SidePanel
      tabs={panelTabs}
      tab={panelTab}
      onTabChange={setPanelTab}
      segment={activeSegment}
      segmentIndex={activeIndex}
      focusSignal={panelFocus}
      renderPanel={renderPanel}
      onClose={onClose}
    />
  );

  const viewTabs = [
    { id: 'outline', label: 'Outline' },
    { id: 'variations', label: 'Variations', count: outline?.variations?.length ?? 0 },
    { id: 'intro', label: 'Intro and outro' },
  ];
  const meta = { podcastName: form.podcastName, hostCount: form.hostCount };
  const status = saveStatus({ hasOutline: Boolean(outline), isAuthenticated, activeProjectId, dirty, savedAt });

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only rounded bg-page px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50">
        Skip to the outline
      </a>
      <p className="sr-only" aria-live="polite">{announcement}</p>

      <Header
        status={status}
        timeline={outline && !generating ? { segments, activeId: activeSegmentId, onSelect: setActiveSegmentId } : null}
        onOpenAuth={() => setModal('auth')}
        onOpenProjects={() => setModal('projects')}
        onOpenShortcuts={() => setModal('shortcuts')}
      />

      <main id="main" tabIndex={-1} className="mx-auto max-w-[1180px] px-4 pb-24 pt-6 outline-none sm:px-6">
        <div className={`grid grid-cols-1 gap-x-10 ${outline ? 'lg:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}>
          <div className={`min-w-0 max-w-[46rem] ${outline ? '' : 'mx-auto w-full'}`}>
            <BriefForm workspace={workspace} hasOutline={Boolean(outline)} onGeneratingChange={setGenerating} onGenerated={handleGenerated} focusSignal={briefFocus} />

            {generating && (
              <div className="mt-6" role="status">
                <p className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
                  <Spinner className="h-3.5 w-3.5" label="Generating" />
                  Writing the outline. This usually takes 10 to 20 seconds.
                </p>
                <OutlineSkeleton />
              </div>
            )}

            {outline && !generating && (
              <div className="mt-6">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0 max-w-full overflow-x-auto">
                    <Tabs tabs={viewTabs} value={view} onChange={setView} ids={viewIds} label="Outline views" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving} title="Save (Ctrl or Cmd + S)">
                      {saving && <Spinner className="h-3.5 w-3.5" label="Saving" />}
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" className="btn" onClick={handleShare}>Share</button>
                    <ExportMenu outline={outline} meta={meta} />
                  </div>
                </div>

                <div id={viewIds.panelId(view)} role="tabpanel" aria-labelledby={viewIds.tabId(view)}>
                  {view === 'outline' && (
                    <OutlineDocument
                      workspace={workspace}
                      readOnly={false}
                      activeSegmentId={activeSegmentId}
                      activePanelTab={isDesktop || sheetOpen ? panelTab : null}
                      openCommentCounts={openCounts}
                      onSelectSegment={setActiveSegmentId}
                      onOpenPanel={openPanel}
                    />
                  )}
                  {view === 'variations' && <VariationsView workspace={workspace} onEditBrief={editBrief} />}
                  {view === 'intro' && <IntroOutroView workspace={workspace} />}
                </div>
              </div>
            )}
          </div>

          {outline && isDesktop && (
            <aside aria-label="Segment tools" data-side-panel className="sticky top-28 hidden h-[calc(100vh-8rem)] self-start border-l border-line pl-6 lg:block">
              {sidePanel(null)}
            </aside>
          )}
        </div>
      </main>

      {outline && !isDesktop && sheetOpen && (
        <PanelSheet label="Segment tools" onClose={closePanel}>
          <div data-side-panel className="flex h-full min-h-0 flex-col">{sidePanel(closePanel)}</div>
        </PanelSheet>
      )}

      {modal === 'auth' && <AuthModal onClose={() => setModal(null)} onSuccess={handleAuthSuccess} />}
      {modal === 'projects' && <ProjectsList onClose={() => setModal(null)} onOpenProject={handleOpenProject} />}
      {modal === 'share' && <ShareDialog workspace={workspace} persistProject={persistProject} onClose={() => setModal(null)} />}
      {modal === 'shortcuts' && <ShortcutsSheet onClose={() => setModal(null)} />}
      {modal === 'import' && (
        <Modal title="Save your draft to your account?" onClose={() => setModal(null)}>
          <p className="mb-5 text-sm text-ink-muted">
            The outline on this device isn&apos;t linked to your account yet. Save it as a project so it follows you to any device.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setModal(null)}>Not now</button>
            <button type="button" className="btn btn-primary" onClick={handleImportConfirm} data-autofocus>Save it</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
