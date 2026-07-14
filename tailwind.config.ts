import type { Config } from 'tailwindcss'

// Direction B — "Refined Cyberpunk". Dark navy grounds, disciplined teal/blue
// accents, mono for data/labels. Tokens mirror the approved mockup so the
// public pages share one system.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#eaf6ff',   // primary text
          sub: '#7f97b0',       // secondary text
          dim: '#546b85',       // tertiary / hints
        },
        base: '#070c16',        // page background
        panel: '#0c1522',       // cards / surfaces
        'panel-2': '#0f1c2e',   // raised surface
        line: '#16283c',        // borders
        'line-soft': 'rgba(125,235,234,0.06)',
        brand: {
          DEFAULT: '#2fe6c8',   // primary accent (teal)
          blue: '#39a0ff',      // secondary accent
          deep: '#0b6279',
        },
        good: '#00e676',
        warn: '#ffab40',
        bad: '#ff5252',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 30px rgba(0,0,0,0.35)',
        glow: '0 0 24px rgba(47,230,200,0.18)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22,0.8,0.28,1) both',
      },
    },
  },
  plugins: [],
  // Preflight (Tailwind's global reset) is disabled so the existing CSS-module
  // pages (admin, dashboard) keep their current styling untouched. globals.css
  // already provides a reset. We only use Tailwind's utility classes.
  corePlugins: {
    preflight: false,
  },
}

export default config
