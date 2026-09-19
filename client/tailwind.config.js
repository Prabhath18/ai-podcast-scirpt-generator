/** @type {import('tailwindcss').Config} */
// Every color is a CSS variable holding an "R G B" triple (defined per theme
// in src/index.css) so Tailwind opacity modifiers keep working. See DESIGN.md
// for the reasoning behind the palette, type scale and radii.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // The type scale is replaced rather than extended: these are the only sizes in the UI.
    fontSize: {
      '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em' }], // 11/16 mono labels
      xs: ['0.75rem', '1rem'], // 12/16 meta
      sm: ['0.8125rem', '1.25rem'], // 13/20 UI
      base: ['0.9375rem', '1.5rem'], // 15/24 body
      prose: ['1.0625rem', '1.65rem'], // 17/26.4 reading text
      lg: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.005em' }], // 20/28 segment titles
      xl: ['1.625rem', { lineHeight: '2rem', letterSpacing: '-0.01em' }], // 26/32
      '2xl': ['2.125rem', { lineHeight: '2.5rem', letterSpacing: '-0.015em' }], // 34/40 episode title
    },
    borderRadius: {
      none: '0',
      sm: '2px', // tags, timeline blocks
      DEFAULT: '4px', // buttons, inputs
      md: '6px',
      lg: '8px', // dialogs, menus, the mobile sheet
      full: '9999px',
    },
    extend: {
      fontFamily: {
        serif: ['"Newsreader Variable"', 'Newsreader', 'Georgia', 'serif'],
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'JetBrains Mono', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        paper: token('paper'), // app background
        page: token('page'), // the document and panels
        sunken: token('sunken'), // wells, hover fills, table headers
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        ink: { DEFAULT: token('ink'), muted: token('ink-muted'), faint: token('ink-faint') },
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          tint: token('accent-tint'),
          fg: token('accent-fg'),
        },
        ok: { DEFAULT: token('ok'), tint: token('ok-tint') },
        warn: { DEFAULT: token('warn'), tint: token('warn-tint') },
        danger: { DEFAULT: token('danger'), tint: token('danger-tint') },
      },
      boxShadow: {
        // The only shadow in the product: floating layers (menus, dialogs, toasts).
        float: '0 8px 24px -8px rgb(17 24 39 / 0.18), 0 1px 3px rgb(17 24 39 / 0.08)',
      },
      maxWidth: { measure: '68ch' },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'rise-in': { from: { transform: 'translateY(6px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        'sheet-in': { from: { transform: 'translateY(16px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        pulse: { '50%': { opacity: 0.55 } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'rise-in': 'rise-in 180ms ease-out',
        'sheet-in': 'sheet-in 200ms ease-out',
        pulse: 'pulse 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
