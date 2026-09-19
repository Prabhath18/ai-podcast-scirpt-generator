import Modal from './Modal.jsx';

const SHORTCUTS = [
  ['/', 'Edit the brief'],
  ['J / K', 'Next / previous segment'],
  ['E', 'Deep Dive on the selected segment'],
  ['R', 'Research the selected segment'],
  ['C', 'Comments on the selected segment'],
  ['Ctrl/Cmd + S', 'Save the project'],
  ['Esc', 'Close a panel or dialog'],
  ['?', 'Show this list'],
];

const EDITING = [
  ['Enter', 'Save the field you are editing'],
  ['Ctrl/Cmd + Enter', 'Save a multi-line field'],
  ['Esc', 'Discard the change'],
];

function Table({ rows }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([keys, action]) => (
        <div key={keys + action} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-sm text-ink-muted">{action}</dt>
          <dd className="font-mono text-xs text-ink">{keys}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ShortcutsSheet({ onClose }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <Table rows={SHORTCUTS} />
      <p className="label mb-1 mt-5">While editing text</p>
      <Table rows={EDITING} />
      <p className="mt-4 text-xs text-ink-faint">Single-key shortcuts are off while you type in a field.</p>
    </Modal>
  );
}
