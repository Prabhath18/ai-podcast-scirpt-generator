import Modal from './Modal.jsx';

/**
 * A two-button confirmation on the shared Modal. Focus starts on Cancel, so pressing Enter
 * or Space right after it opens never discards anything; Escape and the backdrop also cancel.
 */
export default function ConfirmDialog({ title, message, cancelLabel = 'Cancel', confirmLabel, onCancel, onConfirm }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-5 text-sm text-ink-muted">{message}</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel} data-autofocus>{cancelLabel}</button>
        <button type="button" className="btn btn-primary" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
