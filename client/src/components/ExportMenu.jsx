import { useEffect, useRef, useState } from 'react';
import { toMarkdown, toPlainText, toPrintableHtml, downloadFile, slugify } from '../utils/exportFormatter.js';

const STORAGE_KEY = 'podcast-export-sources';

function readPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** "Download Script": Markdown, plain text, or a print-ready page; pinned sources are an opt-in section. */
export default function ExportMenu({ outline, meta }) {
  const [open, setOpen] = useState(false);
  const [includeSources, setIncludeSources] = useState(readPreference);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  const pinned = outline.segments.reduce((sum, s) => sum + (s.sources?.length || 0), 0);
  const options = { includeSources: includeSources && pinned > 0 };
  const slug = slugify(outline.episode_title);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleSources = (checked) => {
    setIncludeSources(checked);
    try {
      localStorage.setItem(STORAGE_KEY, checked ? '1' : '0');
    } catch {
      /* preference just won't persist */
    }
  };

  const finish = () => setOpen(false);
  const formats = [
    ['Markdown (.md)', () => downloadFile(`${slug}.md`, toMarkdown(outline, meta, options), 'text/markdown')],
    ['Plain text (.txt)', () => downloadFile(`${slug}.txt`, toPlainText(outline, meta, options), 'text/plain')],
    [
      'Print or save as PDF',
      () => {
        const url = URL.createObjectURL(new Blob([toPrintableHtml(outline, meta, options)], { type: 'text/html' }));
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      },
    ],
  ];

  return (
    <div className="relative" ref={rootRef}>
      <button ref={triggerRef} type="button" className="btn" aria-expanded={open} aria-controls="export-panel" onClick={() => setOpen((o) => !o)}>
        Download Script
      </button>

      {open && (
        <div id="export-panel" role="group" aria-label="Download Script" className="absolute right-0 top-full z-20 mt-1 w-72 animate-fade-in rounded-lg border border-line-strong bg-page p-3 shadow-float">
          <ul className="space-y-1">
            {formats.map(([label, run]) => (
              <li key={label}>
                <button type="button" className="btn btn-quiet w-full justify-start" onClick={() => { run(); finish(); }}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <label className={`mt-2 flex items-start gap-2.5 border-t border-line px-1 pt-3 text-sm ${pinned === 0 ? 'text-ink-faint' : ''}`}>
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" checked={includeSources && pinned > 0} disabled={pinned === 0} onChange={(e) => toggleSources(e.target.checked)} />
            <span>
              Include a Sources section
              <span className="block text-xs text-ink-faint">
                {pinned === 0 ? 'Pin sources from the Research tab first.' : `${pinned} pinned ${pinned === 1 ? 'source' : 'sources'}, marked “verify before citing”.`}
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
