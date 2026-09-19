import { useEffect, useRef } from 'react';
import Tabs, { useTabIds } from './Tabs.jsx';
import { useFocusLayer } from './Modal.jsx';

/**
 * The persistent right-hand panel: Deep Dive, Research and Comments for the
 * selected segment (or the whole episode). On wide screens it stays beside the
 * document; on phones the same content opens in a bottom sheet (PanelSheet).
 * `renderPanel(tab)` supplies each tab's body.
 */
export default function SidePanel({ tabs, tab, onTabChange, segment, segmentIndex, focusSignal, renderPanel, onClose }) {
  const ids = useTabIds();
  const tabRefs = useRef({});

  // Opening a panel from a segment moves focus to its tab, so keyboard and
  // screen-reader users land where the new content is.
  useEffect(() => {
    if (focusSignal) tabRefs.current[tab]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a panel is (re)opened, not on every tab change
  }, [focusSignal]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label">{segment ? `Segment ${String(segmentIndex + 1).padStart(2, '0')}` : 'Whole episode'}</p>
          <p className="line-clamp-2 font-serif text-lg font-semibold leading-snug">{segment ? segment.title : 'No segment selected'}</p>
        </div>
        {onClose && (
          <button type="button" className="btn btn-quiet shrink-0" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <Tabs tabs={tabs} value={tab} onChange={onTabChange} ids={ids} label="Panel" tabRefs={tabRefs} />

      <div id={ids.panelId(tab)} role="tabpanel" aria-labelledby={ids.tabId(tab)} tabIndex={0} className="scrollbar-thin mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {renderPanel(tab)}
      </div>
    </div>
  );
}

/** Phone layout: the panel as a bottom sheet with focus trapped inside until it closes. */
export function PanelSheet({ onClose, label, children }) {
  const ref = useFocusLayer(onClose);
  return (
    <div className="fixed inset-0 z-40 flex items-end animate-fade-in" role="presentation">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className="relative flex h-[85vh] w-full animate-sheet-in flex-col rounded-t-lg border-t border-line-strong bg-page p-4 shadow-float">
        {children}
      </div>
    </div>
  );
}
