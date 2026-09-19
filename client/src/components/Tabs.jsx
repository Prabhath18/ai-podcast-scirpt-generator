import { useId } from 'react';

/**
 * Underline tabs following the WAI-ARIA pattern: Left/Right/Home/End move
 * between tabs, only the selected tab is in the tab order. `tabs` is
 * [{ id, label, count? }]; render the matching panel yourself using
 * `panelId(id)` / `tabId(id)` on a role="tabpanel" element.
 */
export function useTabIds() {
  const base = useId();
  return { tabId: (id) => `${base}-tab-${id}`, panelId: (id) => `${base}-panel-${id}` };
}

export default function Tabs({ tabs, value, onChange, ids, label, tabRefs }) {
  const move = (event, index) => {
    const keys = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = tabs[(keys[event.key] + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(ids.tabId(next.id))?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="flex items-end gap-5 border-b border-line">
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => tabRefs && (tabRefs.current[tab.id] = node)}
            id={ids.tabId(tab.id)}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={ids.panelId(tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => move(event, index)}
            className={`-mb-px border-b-2 pb-2 pt-1 text-sm font-medium transition-colors duration-150 ${
              selected ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.count > 0 && <span className="tabular ml-1.5 font-mono text-2xs text-ink-faint">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
