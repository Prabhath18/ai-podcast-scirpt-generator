import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import ShareBanner from '../components/ShareBanner.jsx';
import OutlineDisplay from '../components/OutlineDisplay.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { OutlineSkeleton } from '../components/SkeletonLoader.jsx';
import { api, ApiError } from '../services/api.js';
import { sumDurations } from '../utils/durationMath.js';

const noop = () => {};

export default function SharedPage() {
  const { token } = useParams();
  const [outline, setOutline] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/shared/${token}`)
      .then((data) => {
        if (!cancelled) setOutline(data.outline);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load this shared episode.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const readOnlyWorkspace = outline && {
    outline,
    form: { podcastName: '', hostCount: '' },
    totalDurationLive: sumDurations(outline.segments),
    updateOutlineField: noop,
    updateSegment: noop,
    updateTalkingPoint: noop,
    addTalkingPoint: noop,
    removeTalkingPoint: noop,
    updateGuestQuestion: noop,
    addGuestQuestion: noop,
    removeGuestQuestion: noop,
    setGuestQuestions: noop,
    getDeepDive: () => null,
    setDeepDive: noop,
    activeProjectId: null,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ShareBanner />
      <Navbar onOpenAuth={noop} onOpenProjects={noop} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6">
        {!outline && !error && <OutlineSkeleton />}
        {error && <EmptyState icon={AlertTriangle} title="Link unavailable" description={error} />}
        {readOnlyWorkspace && (
          <OutlineDisplay workspace={readOnlyWorkspace} activeSegmentId={null} onExpandSegment={noop} isReadOnly />
        )}
      </main>
    </div>
  );
}
