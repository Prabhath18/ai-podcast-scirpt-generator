import { useRef, useState } from 'react';
import Modal from './Modal.jsx';
import PrintPreview from './PrintPreview.jsx';
import { toMarkdown, toPlainText, downloadFile, slugify } from '../utils/exportFormatter.js';

const SOURCES_KEY = 'podcast-export-sources';

function readSourcesPreference() {
  try {
    return localStorage.getItem(SOURCES_KEY) === '1';
  } catch {
    return false;
  }
}

function Checkbox({ checked, disabled, onChange, children, hint }) {
  return (
    <label className={`flex items-start gap-2.5 text-sm ${disabled ? 'text-ink-faint' : ''}`}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {children}
        {hint && <span className="block text-xs text-ink-faint">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * "Export Script": a button that opens a dialog with three formats. Markdown and plain text
 * download at once, as before. PDF / Print opens the in-app Print Preview, drawn from the
 * outline as it is right now; its Print / Save as PDF button opens the browser's print dialog.
 * `researchNotes` maps segment id to up-to-date Deep Dive notes; it is empty on the shared page.
 */
export default function ExportScript({ outline, meta, researchNotes = {} }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null); // print options while the preview is open
  const [includeSources, setIncludeSources] = useState(readSourcesPreference);
  const [printGuests, setPrintGuests] = useState(true);
  const [printNotes, setPrintNotes] = useState(true);
  const triggerRef = useRef(null);

  const pinned = outline.segments.reduce((sum, s) => sum + (s.sources?.length || 0), 0);
  const hasGuestQuestions = (outline.guest_questions || []).some((q) => q.trim());
  const notesCount = Object.keys(researchNotes).length;
  const sourceOptions = { includeSources: includeSources && pinned > 0 };
  const slug = slugify(outline.episode_title);

  const toggleSources = (checked) => {
    setIncludeSources(checked);
    try {
      localStorage.setItem(SOURCES_KEY, checked ? '1' : '0');
    } catch {
      /* the preference just won't persist */
    }
  };

  const openPreview = () => {
    setOpen(false);
    setPreview({
      ...sourceOptions,
      includeGuestQuestions: hasGuestQuestions && printGuests,
      researchNotes: notesCount > 0 && printNotes ? researchNotes : undefined,
    });
  };

  const download = (filename, content, type) => {
    downloadFile(filename, content, type);
    setOpen(false);
  };

  const closePreview = () => {
    setPreview(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <button ref={triggerRef} type="button" className="btn" onClick={() => setOpen(true)}>
        Export Script
      </button>

      {open && (
        <Modal title="Export Script" onClose={() => setOpen(false)} maxWidthClass="max-w-lg">
          <p className="text-sm text-ink-muted">Choose a format. Everything is exported as you have it now, edits included.</p>

          <ul className="mt-4 divide-y divide-line border-y border-line">
            <li className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">PDF / Print</p>
                  <p className="mt-0.5 text-sm text-ink-muted">Opens a print preview of the finished script. There, choose Print / Save as PDF.</p>
                </div>
                <button type="button" className="btn btn-primary shrink-0" onClick={openPreview} data-autofocus>
                  Open Print Preview
                </button>
              </div>
              {(hasGuestQuestions || notesCount > 0) && (
                <div className="mt-3 space-y-2 border-l-2 border-line pl-3">
                  {hasGuestQuestions && <Checkbox checked={printGuests} onChange={setPrintGuests}>Include guest questions</Checkbox>}
                  {notesCount > 0 && (
                    <Checkbox checked={printNotes} onChange={setPrintNotes} hint={`${notesCount} ${notesCount === 1 ? 'segment has' : 'segments have'} up-to-date Deep Dive notes.`}>
                      Include Deep Dive research notes
                    </Checkbox>
                  )}
                </div>
              )}
            </li>

            <li className="flex items-start justify-between gap-4 py-4">
              <div>
                <p className="font-medium">Markdown</p>
                <p className="mt-0.5 text-sm text-ink-muted">A .md file, good for docs and notes apps.</p>
              </div>
              <button type="button" className="btn shrink-0" onClick={() => download(`${slug}.md`, toMarkdown(outline, meta, sourceOptions), 'text/markdown')}>
                Download .md
              </button>
            </li>

            <li className="flex items-start justify-between gap-4 py-4">
              <div>
                <p className="font-medium">Plain text</p>
                <p className="mt-0.5 text-sm text-ink-muted">A .txt file that opens anywhere.</p>
              </div>
              <button type="button" className="btn shrink-0" onClick={() => download(`${slug}.txt`, toPlainText(outline, meta, sourceOptions), 'text/plain')}>
                Download .txt
              </button>
            </li>
          </ul>

          <div className="mt-4">
            <Checkbox
              checked={includeSources && pinned > 0}
              disabled={pinned === 0}
              onChange={toggleSources}
              hint={pinned === 0 ? 'Pin sources from the Research tab first.' : `${pinned} pinned ${pinned === 1 ? 'source' : 'sources'}, marked “verify before citing”. Applies to all three formats.`}
            >
              Include a Sources section
            </Checkbox>
          </div>
        </Modal>
      )}

      {preview && <PrintPreview outline={outline} meta={meta} options={preview} onClose={closePreview} />}
    </>
  );
}
