import { useState } from 'react';
import Modal from './Modal.jsx';
import Spinner from './Spinner.jsx';
import { api, ApiError } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';

/**
 * Share link controls: create or stop sharing, copy the link, and decide
 * whether signed-in visitors may comment. Anyone with the link can read;
 * the outline itself is never editable from it.
 */
export default function ShareDialog({ workspace, persistProject, onClose }) {
  const { shareToken, commentsEnabled, setShareToken, setCommentsEnabled, activeProjectId } = workspace;
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const url = shareToken ? `${window.location.origin}/shared/${shareToken}` : '';

  const run = async (action, failure) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : failure);
    } finally {
      setBusy(false);
    }
  };

  const createLink = () =>
    run(async () => {
      const id = await persistProject();
      const data = await api.post(`/api/projects/${id}/share`);
      setShareToken(data.shareToken);
      setCommentsEnabled(true);
    }, 'Could not create the link.');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied.');
    } catch {
      toast.error('Your browser blocked copying. Select the link and copy it by hand.');
    }
  };

  // Optimistic: the switch moves at once and snaps back, with an error, if the server refuses.
  const toggleComments = async (enabled) => {
    setCommentsEnabled(enabled);
    try {
      await api.patch(`/api/projects/${activeProjectId}/share`, { commentsEnabled: enabled });
    } catch (err) {
      setCommentsEnabled(!enabled);
      toast.error(err instanceof ApiError ? err.message : 'Could not change the comments setting.');
    }
  };

  const stopSharing = () =>
    run(async () => {
      await api.delete(`/api/projects/${activeProjectId}/share`);
      setShareToken(null);
      toast.success('Sharing stopped. The old link no longer works.');
    }, 'Could not stop sharing.');

  return (
    <Modal title="Share this episode" onClose={onClose} maxWidthClass="max-w-lg">
      {!shareToken ? (
        <>
          <p className="text-sm text-ink-muted">
            Create a read-only link. Anyone who has it can read the outline. People who sign in can also leave comments, and you decide whether that is on.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={createLink} disabled={busy} data-autofocus>
              {busy && <Spinner className="h-3.5 w-3.5" label="Creating" />}
              Save and create link
            </button>
          </div>
        </>
      ) : (
        <>
          <label htmlFor="share-url" className="mb-1.5 block text-sm font-medium">Link</label>
          <div className="flex gap-2">
            <input id="share-url" readOnly value={url} onFocus={(e) => e.target.select()} className="field font-mono text-xs" data-autofocus />
            <button type="button" className="btn shrink-0" onClick={copy}>Copy</button>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" checked={commentsEnabled} onChange={(e) => toggleComments(e.target.checked)} />
            <span>
              Allow comments on this link
              <span className="block text-xs text-ink-faint">
                Signed-in visitors can comment. You can resolve or delete any comment; they can delete their own. Turning this off hides the thread from the link, not from you.
              </span>
            </span>
          </label>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
            <button type="button" className="link-action hover:!text-danger hover:!decoration-danger" onClick={stopSharing} disabled={busy}>
              Stop sharing
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </>
      )}
    </Modal>
  );
}
