# Design

Podcast Outline AI is built to feel like a producer's script editor, not a landing page. The outline is a document: numbered segments in a steady vertical rhythm, a running clock in the gutter, a timeline you can click, and a persistent side panel for Deep Dive, Research and Comments. This file records the decisions and the reasons for them so the interface can be extended without drifting.

Screenshots of every screen are in [docs/screenshots/](docs/screenshots/).

## Principles

1. **Structure comes from type and hairlines, not boxes.** There are no card shadows. Segments are separated by a 1px rule; the only shadow in the product (`shadow-float`) belongs to layers that actually float: menus, dialogs, toasts and the drag preview.
2. **One accent, used sparingly.** A single vermilion marks the primary action, the active segment, the active tab and the current position in the timeline. Everything else is warm neutral.
3. **Text first.** Titles and reading text are serif at a 65 to 75 character measure. UI chrome is sans. Timings and labels are mono, so numbers line up.
4. **Edit in place.** Every piece of content is click-to-edit with predictable keys, so the document never turns into a form.
5. **Never spend the user's quota by surprise.** Selecting a segment makes no network request. Deep Dive and every generation run only when asked.

## Color

All colors are CSS variables holding `R G B` triples (`client/src/index.css`), exposed as Tailwind tokens (`client/tailwind.config.js`). The dark theme is its own palette: warmer, with a lighter accent, rather than an inversion of the light one.

| Token | Role | Light | Dark |
|---|---|---|---|
| `paper` | App background | `#F5F1E8` | `#16140F` |
| `page` | Document, panels, inputs | `#FCFAF5` | `#1D1A14` |
| `sunken` | Wells, hover fills, timeline blocks | `#EDE8DC` | `#12100C` |
| `line` | Hairlines between rows | `#DFD8C8` | `#2E2A21` |
| `line-strong` | Input and button borders | `#C7BEAA` | `#484132` |
| `ink` | Body text | `#1E1B16` | `#ECE6D8` |
| `ink-muted` | Secondary text | `#585246` | `#B2AA98` |
| `ink-faint` | Labels, timings | `#686152` | `#918978` |
| `accent` | Primary action, active state | `#B8401B` | `#E0704A` |
| `accent-hover` | Hover for the primary action | `#9C3414` | `#EC8864` |
| `accent-tint` | Active segment background | `#F3E3DA` | `#3A2218` |
| `accent-fg` | Text on the accent | `#FFFFFF` | `#1A1108` |
| `ok` / `ok-tint` | Saved, resolved | `#2F6B3F` / `#E2EEE2` | `#7ABE89` / `#1C2C20` |
| `warn` / `warn-tint` | Unsaved, stale notes | `#8A5A00` / `#F5E9C8` | `#E0B254` / `#342A14` |
| `danger` / `danger-tint` | Errors, destructive hover | `#A32A2A` / `#F6DCDA` | `#EB8078` / `#3A1E1C` |

**Contrast.** Every text and background pair the interface uses meets WCAG AA (4.5:1) in both themes. `node scripts/checkContrast.mjs` (also `npm run check:contrast`) reads the tokens straight from `index.css`, lists all 20 pairs per theme, and fails if any drops below 4.5. Two values were adjusted because of it: light `ink-faint` was darkened to reach 5.0:1 on `sunken`, and the dark `accent-fg` is a near-black, not white, because white on the lighter dark-theme accent is only 3.2:1.

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

The print view (Download Script, then Print or save as PDF) is laid out as a production script: a title block with podcast name, hosts, tone and runtime; then one row per part with a timing column (`00:00 to 06:00`, `6 mins`) beside the content. Segments, the intro, the outro and guest questions are set to avoid splitting across a page (`break-inside: avoid`), headings are set to stay with what follows them, and speaker turns in duo and group scripts are set in a hanging indent. The file is standalone HTML with a print button that hides itself when printing.

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
