import { useState } from 'react';
import { PanelSkeleton } from './Skeletons.jsx';
import { relativeTime } from '../utils/relativeTime.js';
import { useToast } from '../hooks/useToast.jsx';
import { ApiError } from '../services/api.js';

const MAX_LENGTH = 1000;
const FILTERS = [
  ['open', 'Open'],
  ['resolved', 'Resolved'],
  ['all', 'All'],
];

function Comment({ comment, segmentLabel, canResolve, canDelete, onResolve, onDelete }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className={`py-3 ${comment.resolved ? 'opacity-70' : ''}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">{comment.author.name}</span>
        <time className="tabular font-mono text-2xs text-ink-faint" dateTime={comment.createdAt}>{relativeTime(comment.createdAt)}</time>
        {segmentLabel && <span className="label ml-auto">{segmentLabel}</span>}
      </div>
      {/* React escapes the text; whitespace-pre-wrap keeps the author's line breaks. */}
      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.body}</p>
      <div className="mt-1.5 flex items-center gap-4">
        {comment.resolved && <span className="font-mono text-2xs uppercase text-ok">Resolved</span>}
        {canResolve && (
          <button type="button" className="link-action" onClick={onResolve}>
            {comment.resolved ? 'Reopen' : 'Resolve'}
          </button>
        )}
        {canDelete &&
          (confirming ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-ink-muted">Delete this comment?</span>
              <button type="button" className="link-action !text-danger" onClick={onDelete}>Delete</button>
              <button type="button" className="link-action" onClick={() => setConfirming(false)}>Keep</button>
            </span>
          ) : (
            <button type="button" className="link-action" onClick={() => setConfirming(true)}>
              Delete
            </button>
          ))}
      </div>
    </li>
  );
}

/**
 * The comment thread for a segment, the episode, or everything. `unavailable`
 * explains why there is no thread yet ('login', 'unsaved' or 'disabled'); otherwise
 * `comments` is a useComments() result.
 */
export default function CommentsPanel({ comments, segment, segments, scope, onScopeChange, isOwner, unavailable, onLogin, canPost }) {
  const toast = useToast();
  const [filter, setFilter] = useState('open');
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  if (unavailable === 'login') {
    return (
      <div className="border border-dashed border-line-strong px-4 py-6">
        <p className="font-serif text-lg font-semibold">Sign in to comment</p>
        <p className="mt-1 text-sm text-ink-muted">Comments belong to an account so everyone knows who said what.</p>
        <button type="button" className="btn btn-primary mt-4" onClick={onLogin}>Log in or sign up</button>
      </div>
    );
  }
  if (unavailable === 'unsaved') {
    return (
      <div className="border border-dashed border-line-strong px-4 py-6">
        <p className="font-serif text-lg font-semibold">Comments start once it is saved</p>
        <p className="mt-1 text-sm text-ink-muted">Save this outline to your account, then share it. Collaborators who sign in can comment on any segment from the link.</p>
      </div>
    );
  }
  if (unavailable === 'disabled' || comments.status === 'disabled') {
    return <p className="text-sm text-ink-muted">The owner has turned comments off for this link.</p>;
  }
  if (comments.status === 'login') {
    return (
      <div className="border border-dashed border-line-strong px-4 py-6">
        <p className="font-serif text-lg font-semibold">Sign in to comment</p>
        <p className="mt-1 text-sm text-ink-muted">Log in or sign up to read and write comments on this episode.</p>
        <button type="button" className="btn btn-primary mt-4" onClick={onLogin}>Log in or sign up</button>
      </div>
    );
  }
  if (comments.status === 'loading') return <PanelSkeleton lines={5} />;
  if (comments.status === 'error') {
    return (
      <div className="rounded-md border border-danger/40 bg-danger-tint p-3 text-sm text-danger" role="alert">
        <p>{comments.message || 'Could not load comments.'}</p>
        <button type="button" className="link-action mt-2 !text-danger" onClick={comments.refresh}>Try again</button>
      </div>
    );
  }

  const inScope = (comment) => (scope === 'all' ? true : scope === 'segment' ? segment && comment.segmentId === segment.id : comment.segmentId == null);
  const scoped = comments.comments.filter(inScope);
  const visible = scoped.filter((c) => (filter === 'all' ? true : filter === 'resolved' ? c.resolved : !c.resolved));
  const segmentLabel = (comment) => {
    if (scope !== 'all') return null;
    const index = segments.findIndex((s) => s.id === comment.segmentId);
    return comment.segmentId == null ? 'Episode' : index >= 0 ? `Segment ${index + 1}` : 'Removed segment';
  };
  const target = scope === 'segment' && segment ? segment : null;
  const composerLabel = target ? `Comment on “${target.title}”` : 'Comment on the episode';

  const run = async (action, failure) => {
    try {
      await action();
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : failure);
      return false;
    }
  };

  const post = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    const ok = await run(() => comments.add({ segmentId: target ? target.id : null, body }), 'Could not post your comment.');
    setPosting(false);
    if (ok) setDraft('');
  };

  const emptyText =
    scoped.length === 0
      ? target
        ? 'No comments on this segment yet. Leave a note for whoever edits next.'
        : scope === 'all'
          ? 'No comments on this episode yet.'
          : 'No episode-level comments yet.'
      : `No ${filter} comments here.`;

  return (
    <div>
      {comments.mode === 'local' && <p className="mb-3 text-xs text-ink-faint">Sample comments. In a demo they live in this browser only.</p>}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Comment scope" className="inline-flex rounded border border-line-strong bg-sunken p-0.5 text-sm">
          {[
            ['segment', 'Segment', Boolean(segment)],
            ['episode', 'Episode', true],
            ['all', 'All', true],
          ].map(([value, label, available]) => (
            <button key={value} type="button" role="radio" aria-checked={scope === value} disabled={!available} onClick={() => onScopeChange(value)}
              className={`rounded-sm px-2.5 py-0.5 disabled:opacity-40 ${scope === value ? 'bg-page font-medium text-ink shadow-[0_0_0_1px_rgb(var(--line-strong))]' : 'text-ink-muted hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Show comments" className="flex gap-3 text-xs">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={filter === value} onClick={() => setFilter(value)} className={`link-action ${filter === value ? '' : 'no-underline'}`} data-active={filter === value}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="border-y border-line py-4 text-sm text-ink-muted">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {visible.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              segmentLabel={segmentLabel(comment)}
              canResolve={isOwner}
              canDelete={isOwner || comment.isMine}
              onResolve={() => run(() => comments.setResolved(comment.id, !comment.resolved), 'Could not update the comment.')}
              onDelete={() => run(() => comments.remove(comment.id), 'Could not delete the comment.')}
            />
          ))}
        </ul>
      )}

      {canPost && (
        <form onSubmit={post} className="mt-4">
          <label htmlFor="comment-body" className="mb-1.5 block text-sm font-medium">{composerLabel}</label>
          <textarea
            id="comment-body"
            className="field resize-none"
            rows={3}
            maxLength={MAX_LENGTH}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && post(e)}
            placeholder="What should change, and why?"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="tabular font-mono text-2xs text-ink-faint">{draft.length > 800 ? `${draft.length}/${MAX_LENGTH}` : 'Ctrl/Cmd + Enter to post'}</p>
            <button type="submit" className="btn btn-primary" disabled={!draft.trim() || posting}>
              {posting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
