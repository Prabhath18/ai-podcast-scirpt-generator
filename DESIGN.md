# Design

Podcast Outline AI is built to feel like a producer's script editor, not a landing page. The outline is a document: numbered segments in a steady vertical rhythm, a running clock in the gutter, a timeline you can click, and a persistent side panel for Deep Dive, Research and Comments. This file records the decisions and the reasons for them so the interface can be extended without drifting.

Screenshots of every screen are in [docs/screenshots/](docs/screenshots/).

## Principles

1. **Structure comes from type and hairlines, not boxes.** There are no card shadows. Segments are separated by a 1px rule; the only shadow in the product (`shadow-float`) belongs to layers that actually float: menus, dialogs, toasts and the drag preview.
2. **One accent, used sparingly.** A single indigo is the primary color on every screen: the primary button, the active segment, the active tab, selected choice chips, the progress bar and the current position in the timeline. Everything else is white, light gray and charcoal, with subtle green, amber and red reserved for status.
3. **Text first.** Titles and reading text are serif at a 65 to 75 character measure. UI chrome is sans. Timings and labels are mono, so numbers line up.
4. **Edit in place.** Every piece of content is click-to-edit with predictable keys, so the document never turns into a form.
5. **Never spend the user's quota by surprise.** Selecting a segment makes no network request. Deep Dive and every generation run only when asked.

## Color

All colors are CSS variables holding `R G B` triples (`client/src/index.css`), exposed as Tailwind tokens (`client/tailwind.config.js`). The dark theme is its own palette (near-black surfaces, a lighter indigo), not an inversion of the light one.

| Token | Role | Light | Dark |
|---|---|---|---|
| `paper` | App background | `#F9FAFB` | `#0F1117` |
| `page` | Cards, panels, inputs | `#FFFFFF` | `#171A22` |
| `sunken` | Secondary surfaces, hover fills, skeletons | `#F3F4F9` | `#12141B` |
| `line` | Hairlines and card borders | `#E5E7EB` | `#262A35` |
| `line-strong` | Input, button and chip borders | `#D1D5DB` | `#3A4050` |
| `ink` | Body text (charcoal) | `#1F2937` | `#ECEEF3` |
| `ink-muted` | Secondary text | `#4B5563` | `#A9AFBD` |
| `ink-faint` | Labels, timings | `#666E7C` | `#8A91A2` |
| `accent` | Primary action, active and selected state | `#4F46E5` | `#818CF8` |
| `accent-hover` | Hover for the primary action | `#4338CA` | `#A5B4FC` |
| `accent-tint` | Selected chips, active segment | `#EEF2FF` | `#202444` |
| `accent-fg` | Text on the accent | `#FFFFFF` | `#0F1117` |
| `ok` / `ok-tint` | Success, saved, resolved | `#15803D` / `#F0FDF4` | `#6EC88C` / `#14281E` |
| `warn` / `warn-tint` | Warning, unsaved, stale notes | `#A16207` / `#FFFBEB` | `#EAB308` / `#302814` |
| `danger` / `danger-tint` | Errors, destructive hover | `#B91C1C` / `#FEF2F2` | `#F08A8A` / `#381C1E` |

**Contrast.** Every text and background pair the interface uses meets WCAG AA (4.5:1) in both themes. `node scripts/checkContrast.mjs` (also `npm run check:contrast`) reads the tokens straight from `index.css`, lists all 20 pairs per theme, and fails if any drops below 4.5. The dark `accent-fg` is a near-black, not white, because white on the lighter dark-theme indigo is only 3.0:1; light `ink-faint` and the amber `warn` were tuned to stay above 4.5:1 on white and on their tints.

Color is never the only signal. Status text says "Unsaved changes" as well as being amber; resolved comments say "Resolved"; the active segment has a rule on its left edge as well as a tint.

## Typography

| Family | Used for | Faces |
|---|---|---|
| Newsreader (variable, self-hosted) | Episode and segment titles, reading text, transitions | roman 400 to 700, italic |
| Inter (variable, self-hosted) | UI: buttons, tabs, forms, comments | 400 to 700 |
| JetBrains Mono (variable, self-hosted) | Timings, durations, labels, keyboard hints | 400 to 700 |

Fonts ship through `@fontsource-variable/*`, so the app makes no third-party font requests and the offline demo looks the same as the online one.

The scale is replaced in `tailwind.config.js`, not extended, so these are the only sizes:

| Class | Size / line | Use |
|---|---|---|
| `text-2xs` | 11 / 16, tracked | Mono labels (`OPEN`, `RUNTIME`) |
| `text-xs` | 12 / 16 | Metadata, timings |
| `text-sm` | 13 / 20 | UI controls, comments |
| `text-base` | 15 / 24 | Body, talking points |
| `text-prose` | 17 / 26.4 | Serif reading text (intro, outro, hooks) |
| `text-lg` | 20 / 28 | Segment titles, panel titles |
| `text-xl` | 26 / 32 | Section titles |
| `text-2xl` | 34 / 40 | Episode title |

Reading text is capped at `max-w-measure` (68ch). The document column is `46rem`, which keeps talking points inside that measure at every width.

## Spacing, radii, elevation

- **Spacing** follows a 4px grid (Tailwind's default scale). In practice: 8px between related items, 16px between groups, 20px vertical padding per segment row, 24px between sections, 40px between the document and the panel.
- **Radii** are small on purpose: `2px` for tags and timeline blocks, `4px` for buttons and inputs, `6px` for callouts, `8px` for dialogs, menus and the mobile sheet. No pills; no fully rounded buttons.
- **Elevation**: none in the page. `shadow-float` only on menus, dialogs, toasts and the item being dragged.

## Layout

```
┌───────────────────────────────────────────────────────────────┐
│ mark  Podcast Outline AI            status  Log in   ?   ◐    │  sticky
│ RUNTIME  [ 1 ][   2   ][    3    ][  4  ][   5   ][  6  ]     │  timeline
├──────────────────────────────────────────┬────────────────────┤
│ Brief · topic · tone · 45 min    Edit    │ SEGMENT 03         │
│ Outline  Variations  Intro and outro     │ The Hidden Costs   │
│                       Save Share Download│ Deep Dive Research │
│ Episode title                            │ Comments           │
│ OPEN   Intro                             │ ─────────────────  │
│ 01     Segment title              6 min  │ (panel content)    │
│ ▪▪▪    00:00 to 06:00                    │                    │
│        – talking point                   │                    │
│ ...                                      │                    │
└──────────────────────────────────────────┴────────────────────┘
```

- The header is sticky and carries the save status, and the timeline sits under it so the runtime is always in view.
- **Timeline**: block widths are proportional to segment duration and update live while you edit. Each block is a button that scrolls to its segment; the selected segment is filled.
- **Gutter**: a fixed column holds the segment number and the drag grip; a matching mono label (`OPEN`, `GUEST`, `CLOSE`) marks the non-segment blocks, so every row shares one left edge.
- **Side panel**: sticky at 1024px and up. Below that the same content opens as a bottom sheet with focus trapped in it.
- Breakpoints checked: 375, 768, 1024, 1440.

## Components and patterns

| Pattern | Behavior |
|---|---|
| `EditableText` | Reads as text. Click, or focus and press Enter, to edit. Enter saves (Ctrl/Cmd+Enter in multi-line). Escape discards. Leaving the field saves. Numeric and required variants revert on invalid input. |
| Buttons | `.btn` is a 32px, hairline-bordered, 4px-radius control. `.btn-primary` (accent) appears at most once per view. `.btn-quiet` has no border until hover. |
| `.link-action` | Underlined text actions inside the document (Deep Dive, Research, Add a point). Accent when active. |
| Segmented control | Real `radiogroup` semantics; arrow keys move the choice. |
| Tabs | WAI-ARIA tabs: arrow keys, Home and End, roving tab index. |
| Undo toast | Removing a segment, talking point, guest question or pinned source, choosing a variation, blending a segment, and regenerating hooks all show a toast with Undo (7s). |
| Focus layer | Dialogs and the mobile sheet move focus in, trap Tab, close on Escape or outside click, and return focus to whatever opened them. |
| Skeletons | Reproduce the final layout (same gutter and row rhythm) so nothing jumps when content arrives. |

## Interaction

- **Keyboard**: `/` edit the brief, `J` / `K` next or previous segment, `E` Deep Dive, `R` Research, `C` Comments, `Ctrl/Cmd+S` save, `?` shortcut sheet, `Esc` close. Single-key shortcuts are disabled while typing.
- **Reorder**: drag the grip, or focus it, press Space, use the arrow keys, and press Space to drop. Screen readers get announcements such as "Dropped segment 2, Where They Genuinely Save Time, at position 3."
- **Save status** in the header is honest: "Draft on this device", "Not saved to your account", "Unsaved changes", or "Saved 3 min ago".
- **Errors** name what happened and offer a way forward: a retry, "Open a demo" when no API key is set, or "Log in" where an account is needed.

## Motion

Motion is 150 to 200 ms with ease-out and used for orientation only: toasts rise in, dialogs and the sheet fade and slide a few pixels, buttons change color. Reordering uses dnd-kit's own transform. Under `prefers-reduced-motion: reduce` all animation and transition durations collapse to near zero and smooth scrolling is turned off.

## Accessibility

- Landmarks: skip link, `header`, `main`, `aside` (named), `section`s with accessible names.
- Every icon-only control has an accessible name; most controls have no icon at all.
- Focus is a 2px accent ring on keyboard focus only, with a 2px offset.
- Live regions announce segment selection (J / K), toasts and the drag lifecycle.
- Forms use real labels, `aria-invalid` and `role="alert"` for errors.
- External links say they open in a new tab to screen readers.

## Printable script

**Export Script** is a modal: three rows (PDF / Print, Markdown, Plain text) with one action each, print-only options (guest questions, Deep Dive notes) tucked under the PDF row and shown only when they apply, and one shared "Include a Sources section" checkbox at the bottom.

**PDF / Print** opens the Print Preview: a full-screen layer with a slim toolbar (Close preview on the left, the accent **Print / Save as PDF** button on the right, a one-line hint about choosing Save as PDF) above a white A4-proportioned sheet on a gray desk. The sheet is always light, whatever the app theme.

The script is laid out as a production script: a title block with the podcast, hosts, tone and runtime as labelled facts; then one row per part with a timing column on the left (`00:00`, `to 06:00`, `6 mins`) beside the content. Segments, the intro, the outro and guest questions are set to avoid splitting across a page (`break-inside: avoid`), headings stay with what follows them, orphans and widows are held at 2 to 3 lines, long text wraps (`overflow-wrap: anywhere`), and speaker turns in duo and group scripts use a hanging indent. Pages are A4 with 16 to 18 mm margins and a page number in the corner where the browser supports margin boxes.

For print, a `@media print` block hides the app (`#root`) and the toolbar, makes the preview flow instead of sitting in a fixed screen, and forces every element to black text on a transparent background with no shadow. The app's CSS reset removes list markers, so the script restores bullets and numbers explicitly. Source URLs are printed as text, since a link cannot be clicked on paper.

## Landing page

`/` is a single page built from the same parts as the app: a light-gray page, serif headings, hairline rules and the shared card, one accent for the primary action. There are no icons beside headings, no gradients and no stock imagery; the hero is a headline, one sentence and two buttons. The proof is a real outline: the sample preview renders the bundled demo with the same gutter, running clock and talking-point dashes as the editor, so what a visitor sees is what they get.

Structure: skip link, `header` with a named `nav`, `main` with named sections (hero, How it works, What you get, sample, closing call to action), `footer`. There is one `h1`. In-page links point at real section ids with `scroll-mt` for the sticky header. Signed-in visitors see **Open app** in place of **Get started**, and the sign-in buttons are held back until the first session check finishes so nothing flickers. On phones the links drop to a second row beneath the wordmark and buttons; the page has no horizontal scroll from 320 to 1440px.

## One set of components

Every screen draws from the same few classes in `client/src/index.css`, so no page carries its own variant of a button, card or badge. Radii: 4px for controls, 8px for cards, dialogs and menus. There are no shadows except `shadow-float` on layers that float.

| Class | Used for |
|---|---|
| `.btn`, `.btn-primary`, `.btn-quiet` | Every button. One primary (indigo) per view. |
| `.field` | Every text input, textarea and select. |
| `.choice` (+ `.choice-sm`) | Every "pick one": tone, hosts, structures, research and comment scopes, comment filters. Selected is an indigo tint with an indigo border. One `Segmented` component renders them with radio semantics and arrow keys. |
| `.card`, `.card-muted` | Cards: the sample outline, generation progress, empty states, the "sign in to comment" boxes. |
| `.callout-ok`, `.callout-warn`, `.callout-danger` | Every inline status message: generation errors, stale Deep Dive notes, failed loads. |
| `.badge-ok`, `.badge-accent`, `.badge-warn`, `.badge-neutral` | State labels such as Resolved and In use. |
| `.label`, `.link-action` | Small mono section labels; underlined text actions inside the document. |

Icons come from one set (lucide, 16px, 2px stroke) and are used only where a control has no text: close, theme, and the step checks in generation progress.

## Generation and empty states

- **Generating Outline.** While an outline is generated the New Episode screen shows a card with the title, an estimated progress bar, four steps (Analysing podcast strategy, Structuring narrative flow, Drafting guest questions, Synthesising outline) and a skeleton of the outline to come. The API is one request and reports no stages, so the steps advance on a timer and the bar levels off below 100% until the response arrives; it is an estimate, and its `aria-label` says so. Screen readers get "Step 2 of 4: Structuring narrative flow".
- **Inline error.** A failed generation shows a red callout under the form, not a toast and not a page: a specific title, one plain sentence about what happened, **Retry Generation** (same request again) and **Back to Edit Settings** (dismisses the error and puts the cursor in the topic field). Focus moves to it. A missing API key adds **Open a demo**.
- **My episodes, empty.** "No episodes drafted yet", one line of help, and **Create Your First Episode**, which closes the dialog and focuses the topic field.

## Mark and name

The mark is three rows of different lengths on an accent square: an outline, and also segments of an episode. It doubles as the favicon (`client/public/favicon.svg`), which switches to the dark accent under a dark browser theme. The wordmark is "Podcast Outline" in Newsreader semibold, with "AI" in the accent color.

## Self-review

Every screen (brief, outline, variations, intro and outro, research, comments, shortcuts, print view) was captured at 375, 768, 1024 and 1440 px in both themes with `scripts/screenshots.mjs`, and read through. What looked wrong or generic, and what was done:

| Finding | Fix |
|---|---|
| "Use this outline" sat below a long segment list, so the main action of the Variations view was off screen | Moved to the top of each column, under the summary |
| Research panel showed a disabled search box for offline demo results | The search form is hidden for demos; the sample-results note explains why |
| Long segment titles were cut to one line in the panel header | Allowed two lines |
| The empty brief had a stray hairline under it, implying content that wasn't there | The rule only draws once an outline follows |
| Wordmark text sat about 2px above the mark's centre | Optical alignment nudge |
| Active-segment tint in the dark theme read as heavy brown | Tint opacity reduced from 60% to 40% |
| One palette pair failed contrast (light `ink-faint` on `sunken`, 4.45:1) | Darkened to 5.0:1; the check script now guards it |
| Selecting a segment fired a Deep Dive request through the panel's default tab | Requests now happen only on an explicit Deep Dive action; the tab shows a "Write research notes" button instead |
| Focus did not return to the opener when the phone sheet closed | The opener is recorded before child effects can move focus |
| The comments switch waited for the network before moving | Optimistic update that reverts with an error if it fails |

Checked and left as they are: the native `<select>` used for "Replace…" (accessible, and it keeps the control from inventing a custom menu), and the mono timeline numbers, which are intentionally plain.
