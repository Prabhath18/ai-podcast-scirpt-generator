import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileDown, Printer, ChevronDown } from 'lucide-react';
import { toMarkdown, toPlainText, toPrintableHtml, downloadFile, slugify } from '../utils/exportFormatter.js';

export default function ExportPanel({ outline, meta }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const slug = slugify(outline.episode_title);

  const handleMarkdown = () => {
    downloadFile(`${slug}.md`, toMarkdown(outline, meta), 'text/markdown');
    setOpen(false);
  };

  const handleText = () => {
    downloadFile(`${slug}.txt`, toPlainText(outline, meta), 'text/plain');
    setOpen(false);
  };

  const handlePrint = () => {
    const html = toPrintableHtml(outline, meta);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    // Give the new tab a moment to render before the URL is revoked; if
    // pop-ups are blocked, `win` is null and we simply skip auto-printing.
    if (win) {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3.5 py-2 text-sm font-medium text-ink hover:border-ink-faint transition-colors"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        Download Script
        <ChevronDown className="w-3.5 h-3.5 text-ink-faint" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-surface-raised shadow-popover py-1.5 z-20 animate-fade-in"
        >
          <button role="menuitem" type="button" onClick={handleMarkdown} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink hover:bg-surface-sunken text-left">
            <FileText className="w-4 h-4 text-ink-muted" aria-hidden="true" />
            Markdown (.md)
          </button>
          <button role="menuitem" type="button" onClick={handleText} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink hover:bg-surface-sunken text-left">
            <FileDown className="w-4 h-4 text-ink-muted" aria-hidden="true" />
            Plain text (.txt)
          </button>
          <button role="menuitem" type="button" onClick={handlePrint} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink hover:bg-surface-sunken text-left">
            <Printer className="w-4 h-4 text-ink-muted" aria-hidden="true" />
            Print / Save as PDF
          </button>
        </div>
      )}
    </div>
  );
}
