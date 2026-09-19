import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useFocusLayer } from './Modal.jsx';
import { PRINT_STYLES, printableBody } from '../utils/exportFormatter.js';

// Screen-only look: a white sheet on a gray desk. Kept inside @media screen so it can
// never leak into the printout, where PRINT_STYLES takes over (plain black on white).
const SCREEN_STYLES = `
  @media screen {
    .print-root .script { background: transparent; }
    .print-root .script .page { max-width: 210mm; margin: 24px auto 48px; padding: 18mm 16mm; background: #fff; border: 1px solid #d1d5db; }
  }
`;

/**
 * A full-screen preview of the finished script, drawn from the outline it is given (the
 * user's current edits). "Print / Save as PDF" calls the browser's own print dialog, where
 * the user picks "Save as PDF". The preview is portaled to <body> next to #root, so the
 * print styles can hide the whole app and print only the script. Closing it (button or
 * Escape) simply removes it: the workspace underneath was never touched.
 */
export default function PrintPreview({ outline, meta, options, onClose }) {
  const ref = useFocusLayer(onClose);
  const html = useMemo(() => printableBody(outline, meta, options), [outline, meta, options]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Print preview"
      tabIndex={-1}
      className="print-root fixed inset-0 z-[70] overflow-y-auto bg-[#e5e7eb] outline-none"
    >
      <style>{PRINT_STYLES + SCREEN_STYLES}</style>

      <div className="no-print sticky top-0 z-10 border-b border-line bg-page">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button type="button" className="btn" onClick={onClose}>
              Close preview
            </button>
            <p className="hidden text-sm text-ink-muted sm:block">
              In the print dialog, choose <strong className="font-semibold text-ink">Save as PDF</strong> as the destination.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => window.print()} data-autofocus>
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="script" dangerouslySetInnerHTML={{ __html: html }} />
    </div>,
    document.body,
  );
}
