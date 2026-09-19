import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import OutlineDocument from '../components/OutlineDocument.jsx';
import SidePanel, { PanelSheet } from '../components/SidePanel.jsx';
import CommentsPanel from '../components/CommentsPanel.jsx';
import ExportMenu from '../components/ExportMenu.jsx';
import AuthModal from '../components/AuthModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { OutlineSkeleton } from '../components/Skeletons.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useComments, openCountsBySegment } from '../hooks/useComments.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { api, ApiError } from '../services/api.js';
import { sumDurations } from '../utils/durationMath.js';

const noop = () => {};
const TABS = [{ id: 'comments', label: 'Comments' }];

/**
 * The read-only view behind a share link. The outline can't be edited here;
 * signed-in visitors can comment on segments if the owner left comments on.
 */
export default function SharedPage() {
  const { token } = useParams();
  const { isAuthenticated, user } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [shared, setShared] = useState(null);
  const [error, setError] = useState(null);
  const [activeSegmentId, setActiveSegmentId] = useState(null);
  const [scope, setScope] = useState('episode');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [panelFocus, setPanelFocus] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/shared/${token}`)
      .then((data) => !cancelled && setShared(data))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : 'Could not load this shared episode.'));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const outline = shared?.outline;
  const commentsEnabled = shared?.commentsEnabled;
  const unavailable = !commentsEnabled ? 'disabled' : !isAuthenticated ? 'login' : null;
  const comments = useComments({
    mode: outline && commentsEnabled && isAuthenticated ? 'shared' : 'none',
    token,
    enabled: true,
    polling: isDesktop || sheetOpen,
    refreshSignal: panelFocus,
    user,
  });
  const openCounts = useMemo(() => openCountsBySegment(comments.comments), [comments.comments]);

  // The document components expect a workspace; a read-only one just does nothing on edit.
  const workspace = useMemo(
    () =>
      outline && {
        outline,
        form: { podcastName: '', hostCount: '' },
        totalDurationLive: sumDurations(outline.segments),
        updateOutlineField: noop,
        updateSegment: noop,
        reorderSegments: noop,
        updateTalkingPoint: noop,
        addTalkingPoint: noop,
        removeTalkingPoint: noop,
        removeSegment: noop,
        unpinSource: noop,
        updateGuestQuestion: noop,
        addGuestQuestion: noop,
        removeGuestQuestion: noop,
        setGuestQuestions: noop,
      },
    [outline],
  );

  const segments = outline?.segments ?? [];
  const activeIndex = segments.findIndex((s) => s.id === activeSegmentId);
  const activeSegment = activeIndex >= 0 ? segments[activeIndex] : null;
  const effectiveScope = !activeSegment && scope === 'segment' ? 'episode' : scope;

  const openComments = (_tab, segmentId) => {
    setActiveSegmentId(segmentId);
    setScope('segment');
    setPanelFocus((n) => n + 1);
    if (!isDesktop) setSheetOpen(true);
  };

  const panel = (onClose) => (
    <SidePanel
      tabs={TABS}
      tab="comments"
      onTabChange={noop}
      segment={activeSegment}
      segmentIndex={activeIndex}
      focusSignal={panelFocus}
      onClose={onClose}
      renderPanel={() => (
        <CommentsPanel
          comments={comments}
          segment={activeSegment}
          segments={segments}
          scope={effectiveScope}
          onScopeChange={setScope}
          isOwner={Boolean(shared?.viewerIsOwner)}
          canPost={isAuthenticated && commentsEnabled}
          unavailable={unavailable}
          onLogin={() => setAuthOpen(true)}
        />
      )}
    />
  );

  useEffect(() => {
    if (outline) document.title = `${outline.episode_title} · Podcast Outline AI`;
  }, [outline]);

  return (
    <div className="min-h-screen">
      <Header
        note={
          <>
            You are reading a shared outline. It is read-only.{' '}
            <Link to="/app" className="font-medium text-accent underline underline-offset-4">Plan your own episode</Link>
          </>
        }
        timeline={outline ? { segments, activeId: activeSegmentId, onSelect: setActiveSegmentId } : null}
        onOpenAuth={isAuthenticated ? null : () => setAuthOpen(true)}
      />

      <main className="mx-auto max-w-[1180px] px-4 pb-24 pt-6 sm:px-6">
        {!outline && !error && <div className="max-w-[46rem]"><OutlineSkeleton /></div>}
        {error && (
          <EmptyState
            title="This link isn't available"
            description={`${error} Ask the person who shared it for a new link.`}
            className="mx-auto max-w-[46rem]"
          />
        )}

        {outline && (
          <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 max-w-[46rem]">
              <div className="mb-4 flex justify-end">
                <ExportMenu outline={outline} meta={{}} />
              </div>
              <OutlineDocument
                workspace={workspace}
                readOnly
                activeSegmentId={activeSegmentId}
                activePanelTab="comments"
                openCommentCounts={openCounts}
                onSelectSegment={setActiveSegmentId}
                onOpenPanel={openComments}
              />
            </div>

            {isDesktop && (
              <aside aria-label="Comments" className="sticky top-28 hidden h-[calc(100vh-8rem)] self-start border-l border-line pl-6 lg:block">
                {panel(null)}
              </aside>
            )}
          </div>
        )}
      </main>

      {outline && !isDesktop && sheetOpen && <PanelSheet label="Comments" onClose={() => setSheetOpen(false)}>{panel(() => setSheetOpen(false))}</PanelSheet>}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={() => setAuthOpen(false)} />}
    </div>
  );
}
