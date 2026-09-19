# Requirements Traceability

This maps each feature to the files that implement it, how to verify it, and its status. Statuses:

- **Done, tested**: implemented and covered by automated tests that pass.
- **Done, tested and run**: the above, and also exercised in a real browser (and, for generation, against the live model).
- **Done, run by hand only**: implemented and exercised manually, without automated coverage.

## How this was verified

Run `npm install && npm test`. The suites pass: 253 server tests and 156 client tests. `npm run lint` (zero warnings allowed) and `npm run build` are clean, and `npm run check:contrast` confirms every color pair meets WCAG AA in both themes.

- **Server tests** (`server/tests/`) use Vitest and Supertest against an in-memory SQLite database created per test. The LLM module (`services/llm.js`) and `fetch` are mocked, so no test calls Gemini, Wikipedia or NewsAPI. They exercise the real routes, validators, retry logic, permission checks and migrations.
- **Client tests** (`client/src/tests/`) cover the pure logic (duration normalization, blending, the workspace reducer, export formatting, relative time) in Node, and the session and landing behavior as component tests in jsdom with Testing Library against a fake API (`logout.test.jsx`, `landing.test.jsx`, `generation.test.jsx`, `printExport.test.jsx`). Other components are not unit tested.
- **Browser runs.** Chrome, driven by Playwright, exercised the running app: 37 checks on editing, keyboard reorder, undo, shortcuts, comments in demo mode, pinning and export, variations and blending, hooks and outros, save prompts and the phone sheet; and a 20-check two-user flow for sharing and comments. Every screen was captured at 375, 768, 1024 and 1440 px in both themes and reviewed (`DESIGN.md` lists what that turned up and how it was fixed). These scripts are not committed.
- **Live model.** The variations and intro/outro prompts were each run once against the real Gemini API and produced valid output.

**Not verified:** Hugging Face beyond one real outline generation (see the LLM provider row in the table below); no screen reader was used; NewsAPI was tested with a mocked `fetch` only; the print layout was reviewed as HTML in a browser and a PDF was generated, but its page breaks were not inspected page by page and nothing was printed on paper.

## Core features

| # | Feature | Implementing files | How to verify | Status |
|---|---|---|---|---|
| 1 | Brief: topic, tone (or custom), podcast name, hosts, length, guest | `client/src/components/BriefForm.jsx`, `ToneSelector.jsx`, `hooks/constants.js` | Open the app; submit with an empty topic to see inline validation | Done, run by hand only |
| 2 | Outline: 5 to 8 segments, 3 to 5 points, durations, transitions, intro and outro; validated with one retry; durations sum to the requested length | `server/routes/outline.js`, `prompts/outlinePrompt.js`, `prompts/schemas.js`, `services/llm.js`, `services/llmHelper.js`, `validators/outlineSchema.js`, `utils/duration.js` | `npm test -w server` (`generateOutline`, `outlineSchema`, `duration` tests) | Done, tested and run |
| 3 | Outline document: numbered segments, running clock, click-to-edit, live totals, drag to reorder, timeline | `OutlineDocument.jsx`, `SegmentRow.jsx`, `EditableText.jsx`, `Timeline.jsx`, `hooks/workspaceReducer.js`, `utils/durationMath.js` | Edit a title or duration and watch the timeline; reorder with the grip or keyboard | Done, tested and run |
| 4 | Deep Dive: side panel, second call with the full outline, per-segment cache, stale-on-edit, disclaimer. Runs only when requested | `DeepDivePanel.jsx`, `server/routes/outline.js` (`/expand-segment`), `db/schema.sql` (`deep_dive_cache`) | `expandSegment` test asserts caching and staleness; in the app, selecting a segment sends no request | Done, tested and run |
| 5 | Guest Questions: generated, editable, regenerable | `GuestQuestions.jsx`, `server/routes/outline.js`, `prompts/guestQuestionsPrompt.js` | `guestQuestions` test | Done, tested |
| 6 | Export Script: a dialog with PDF / Print, Markdown and Plain text; Markdown and text download at once; PDF / Print opens an in-app Print Preview of the current outline with a Print / Save as PDF button (`window.print()`), print CSS (app and controls hidden, black on white, page margins, sections kept together, wrapping), sections omitted when empty or switched off, optional Deep Dive notes and sources; closing returns to the workspace with edits intact | `ExportScript.jsx`, `PrintPreview.jsx`, `utils/exportFormatter.js` (`printableBody`, `PRINT_STYLES`, `toMarkdown`, `toPlainText`), `sample-output/` | `printExport.test.jsx` (the whole flow), `exportFormatter.test.js`; run Generate, edit, Export Script, PDF / Print, Print / Save as PDF | Done, tested and run (real PDF checked; native print dialog stubbed) |
| 7 | Persistence without an account (`localStorage`), including drafts from older versions | `hooks/workspaceReducer.js` (`loadInitialState`), `hooks/useOutlineWorkspace.js` | `workspaceReducer` test "drafts saved before newer fields existed"; refresh the page mid-edit | Done, tested and run |
| 8 | Accounts, saved projects, ownership, share links | `server/routes/auth.js`, `projects.js`, `shared.js`, `middleware/auth.js`, `AuthModal.jsx`, `ProjectsList.jsx`, `ShareDialog.jsx` | `auth`, `projects` tests; the two-user browser flow | Done, tested and run |
| 9 | Routes: landing page at `/`, workspace at `/app`, share view at `/shared/:token`, unknown URLs to `/`; client-side routes survive a refresh on deploy | `client/src/App.jsx`, `pages/LandingPage.jsx`, `client/vercel.json` | `landing.test.jsx`; open `/`, `/app`, a bogus URL; `README.md` "Routes" | Done, tested and run |
| 10 | Logout and session end: draft, workspace state and open UI are cleared; lands on `/` with `replace`; expired sessions and other tabs handled; anonymous drafts untouched | `hooks/useAuth.jsx`, `services/session.js`, `hooks/useOutlineWorkspace.js`, `AppProviders.jsx` | `logout.test.jsx` (including a slow-`/me` race); the 18-check browser flow | Done, tested and run |
| 11 | Demo mode: no key needed, includes sample variations, sources, hooks and comments | `client/src/services/demoData.js`, `demoExtras.js`, `sample-output/` | Open a demo from the brief and use every tab; `workspaceReducer` tests load a demo | Done, tested and run |

## Stretch features from the brief

| Feature | Implementing files | How to verify | Status |
|---|---|---|---|
| **Multiple outline variations.** One request returns 2 or 3 differently structured outlines with an approach label and rationale; compare, choose one, or blend segments (add or replace) with durations re-normalized; persists in `localStorage` and SQLite | Server: `routes/outline.js` (`/generate-variations`), `prompts/variationsPrompt.js`, `services/variations.js`, `validators/outlineSchema.js` (`validateVariation`), `services/llmHelper.js` (`salvage`). Client: `VariationsView.jsx`, `utils/blend.js`, `hooks/workspaceReducer.js` | `server/tests/variations.test.js` (validation, retry, partial results, duplicate approaches); `client/src/tests/blend.test.js`; `projects.test.js` (SQLite round trip); in the app, generate with "Structures" set to 2 or 3 or open a demo's Variations tab | Done, tested and run (live model once) |
| **Research and source suggestions.** Wikipedia (no key) and optional NewsAPI, proxied by the server with timeouts, caching and a rate limit; sanitized results; pin sources to a segment; optional Sources section in exports; "verify before citing" label; nothing invented | `routes/research.js`, `services/research.js`, `middleware/rateLimiter.js`, `ResearchPanel.jsx`, `ExportMenu.jsx`, `utils/exportFormatter.js` | `server/tests/research.test.js` (mocked `fetch`: mapping, fallback, empty, failure, cache, news on and off); `exportFormatter` tests; the Research tab in the app (live Wikipedia, or samples in a demo) | Done, tested and run (NewsAPI mocked only) |
| **Intro, hook and outro generator.** Five hooks in five styles, a full intro script, three outros, a teaser, in one request; respects solo, duo and group; edit, regenerate, use; flows into the export | `routes/outline.js` (`/intro-outro`), `prompts/introOutroPrompt.js`, `validators/introOutroSchema.js`, `IntroOutroView.jsx` | `server/tests/introOutro.test.js` (styles, counts, speaker labels, retry, stored-shape leniency); `workspaceReducer` tests (`USE_HOOK`, `USE_OUTRO`); the Intro and outro tab | Done, tested and run (live model once) |
| **Comments on segments.** Table and safe migration; owner and signed-in visitors can comment; owner toggles comments per link, resolves and deletes any comment; authors delete their own; badge, side-panel thread, resolved filter, relative times, empty states; 1000-character limit, parameterized queries, rate limit, ownership checks; 30-second polling | `db/migrations.js`, `routes/comments.js`, `routes/projects.js`, `routes/shared.js`, `hooks/useComments.js`, `CommentsPanel.jsx`, `ShareDialog.jsx` | `server/tests/comments.test.js` (owner, commenter, outsider, comments disabled, limits, SQL metacharacters, cascade); `migrations.test.js`; the two-user browser flow | Done, tested and run |

## Interface and design

| Area | Implementing files | How to verify | Status |
|---|---|---|---|
| Generation progress: "Generating Outline", estimated bar, four sequential steps, outline skeleton | `GenerationProgress.jsx`, `pages/WorkspacePage.jsx` | `generation.test.jsx`; generate an outline and watch the New Episode screen | Done, tested and run (steps are timer-based estimates) |
| Inline generation error: title, explanation, Retry Generation, Back to Edit Settings; no toast, no separate page | `GenerationError.jsx`, `BriefForm.jsx` | `generation.test.jsx`; stop the API and generate | Done, tested and run |
| My episodes empty state: "No episodes drafted yet" with Create Your First Episode | `ProjectsList.jsx`, `EmptyState.jsx` | `generation.test.jsx`; sign up and open My episodes | Done, tested and run |
| One visual system: a single indigo primary, white and light-gray surfaces, charcoal text, shared card, callout, badge, chip, button and input styles, in both themes | `client/src/index.css`, `tailwind.config.js`, `FormField.jsx` (`Segmented`), `DESIGN.md` | `npm run check:contrast`; the screenshots in `docs/screenshots/` | Done, tested and run |
| Design system: tokens, type scale, radii, motion, dark theme | `client/src/index.css`, `client/tailwind.config.js`, `DESIGN.md` | `npm run check:contrast`; toggle the theme | Done, tested and run |
| Keyboard: shortcuts, arrow-key tabs and segmented controls, keyboard reorder, focus trap and return | `hooks/useHotkeys.js`, `Modal.jsx`, `Tabs.jsx`, `FormField.jsx`, `OutlineDocument.jsx` | Press `?` in the app; the browser runs checked focus in and out of the phone sheet | Done, run by hand only |
| Responsive at 375, 768, 1024, 1440; no horizontal scroll on phones | `WorkspacePage.jsx`, `SharedPage.jsx`, `SidePanel.jsx` | `npm run screenshots`; the browser run asserts no horizontal scroll at 375 | Done, run by hand only |
| + New Podcast: header button (also in My episodes and on the shared page); blank brief with focus in Topic; confirmation (Cancel / Discard & Create New) only when the outline has unsaved edits; saved projects never deleted or overwritten; nothing from the old podcast (outline, structures, hooks, Deep Dives, comments, in-flight answers) reaches the new one; opening a saved episode over unsaved edits asks the same way | `Header.jsx`, `ConfirmDialog.jsx`, `ProjectsList.jsx`, `pages/WorkspacePage.jsx`, `pages/SharedPage.jsx`, `useOutlineWorkspace.js` (`hasUnsavedChanges`, `trackPodcast`), `workspaceReducer.js` (`NEW_PODCAST`) | `newPodcast.test.jsx` (19 tests); by hand in a browser with a demo | Done, tested |
| Print view as a production script | `PrintPreview.jsx`, `utils/exportFormatter.js` | Export Script, then PDF / Print, then Print / Save as PDF | Done, tested and run (PDF text and page breaks checked; nothing printed on paper) |
| Favicon, page title, wordmark | `client/public/favicon.svg`, `client/index.html`, `Wordmark.jsx` | Look at the browser tab | Done, run by hand only |

## Engineering requirements

| Area | Notes | Status |
|---|---|---|
| One LLM entry point, provider-neutral | `generate(prompt, schema)` in `server/services/llm.js` chooses the provider; the only files that import a provider SDK or call a provider API are `services/llm/gemini.js` and `services/llm/huggingface.js` (`grep -rl "@google/genai" server` returns only `gemini.js`) | Done, tested |
| Parse, validate and retry once, for every provider | `server/services/llmHelper.js` (partial results for variations; timeouts, rate limits and rejected credentials are reported without a retry) and `server/utils/extractJson.js` (finds the JSON in code fences, prose or `<think>` blocks) | Done, tested |
| LLM provider support: Gemini (default) and Hugging Face; `LLM_PROVIDER`; optional `LLM_FALLBACK_PROVIDER`; clear errors for an unknown provider or a missing key; timeouts; demo mode unaffected | `services/llm.js`, `services/llm/gemini.js`, `services/llm/huggingface.js`, `services/llm/jsonSchema.js`, `.env.example`, `README.md` ("LLM providers") | `llmProviders.test.js` (selection, request shape, JSON-mode fallback, error mapping, timeouts, fallback), `llmProvidersRoutes.test.js` (through the real routes, with fenced and prose-wrapped JSON), `llmHelper.test.js`, `extractJson.test.js` | Done, tested with mocked HTTP. One real outline generation on Hugging Face (Llama 3.1 8B Instruct, 19 Sep 2026) returned a valid outline; the other prompts and the fallback were not run against Hugging Face, and a bad token was confirmed to map to `LLM_AUTH` |
| One error shape `{ error, code }` | `server/middleware/errorHandler.js` | Done, tested |
| Rate limiting, request size limits, caching | `middleware/rateLimiter.js` (general, LLM, auth, research, comment writes); `express.json` limit of 300 KB in `app.js`; `utils/memoryCache.js`; `deep_dive_cache` table | Done, tested |
| Safe schema changes | `db/migrations.js` with `PRAGMA user_version` | Done, tested |
| Login limiter scope | Strict limiter on login and signup only (`routes/auth.js`); `/me` and logout use the general limit | Done, tested (`authRateLimit.test.js`) |
| Secrets only in `server/.env`; nothing committed | `.env.example`, `.gitignore` | Done |
| Consistent naming | "Podcast Outline AI" in the header, page title, package names and README. The repository folder `ai-podcast-scirpt-generator` has a typo and can be renamed; nothing depends on it | Done |

## Known simplifications

See "Known limitations" in `README.md` for the full list. In short: the SQLite file is lost on hosts with ephemeral disks; anonymous caches and rate limits are per process; comments cannot be edited and have no notifications; research queries come from the segment title and topic with no LLM keyword step; intro and outro regenerate as a set.

## Alignment with the SRS (section 5, Suggested Tech Stack)

The text of SRS section 5 was not available when this table was written. The SRS column is filled in only where its content is known (the LLM row); the other rows state what the project uses so they can be compared, and their status is left for whoever has the SRS. The same table, with notes, is in `README.md`.

| Area | SRS suggestion | What this project uses | Status |
|---|---|---|---|
| Frontend | *To fill in from SRS section 5* | React 18, Vite, Tailwind CSS, React Router, dnd-kit | Confirm against the SRS |
| Backend | *To fill in from SRS section 5* | Node.js and Express | Confirm against the SRS |
| Database | *To fill in from SRS section 5* | SQLite (`better-sqlite3`), versioned migrations; `localStorage` for drafts without an account | Confirm against the SRS |
| LLM | OpenAI, or Hugging Face (Mistral-7B / Llama) | Gemini by default; Hugging Face Inference Providers supported (default Llama 3.1 8B Instruct); optional fallback between them | **Matches** (Hugging Face) / **Alternative** (Gemini, the default) / **Not built** (OpenAI) |
| Document export | *To fill in from SRS section 5* | Markdown, plain text, and PDF through the browser's print dialog from an in-app Print Preview | Confirm against the SRS |
| Research API | *To fill in from SRS section 5* | Wikipedia API (no key) and optional NewsAPI, called from the server | Confirm against the SRS |
| Deployment | *To fill in from SRS section 5* | Static client on Vercel, Node API on a host with a persistent disk; documented, not deployed by this repository | Confirm against the SRS |

Deviations, stated plainly: OpenAI is not implemented (the SRS lists it as one of several suggestions and a free-tier-friendly path was chosen). Gemini is the default because of its free tier and schema-enforced JSON mode. Hugging Face's free monthly credits are small (about $0.10 at the time of writing), so it is not the default. Mistral-7B was not served by any Inference Provider when this was written; the default Hugging Face model is Llama 3.1 8B Instruct, and `HF_MODEL` accepts others.
