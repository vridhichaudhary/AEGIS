/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'label': ['11px', { lineHeight: '1.4', letterSpacing: '0.06em' }],
        'data': ['14px', { lineHeight: '1.5' }],
        'metric': ['28px', { lineHeight: '1', fontWeight: '600' }],
      },
      colors: {
        aegis: {
          'bg-base':     '#0A0F1A',
          'bg-surface':  '#111827',
          'bg-elevated': '#1C2333',
          'bg-hover':    '#1F2D40',
          'border':      '#1E2D45',
          'border-bright':'#2D4A6E',
          'critical':    '#EF4444',
          'high':        '#F97316',
          'medium':      '#EAB308',
          'low':         '#22C55E',
          'info':        '#3B82F6',
          'text-primary':'#F1F5F9',
          'text-secondary':'#94A3B8',
          'text-muted':  '#4B5563',
          'accent':      '#3B82F6',
          'accent-glow': '#1D4ED8',
          'whatsapp':    '#25D366',
          'purple':      '#A855F7',
        },
      },
      borderRadius: {
        'card': '8px',
      },
      transitionDuration: {
        'hover': '150ms',
        'expand': '200ms',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.5)',
        'focus': '0 0 0 2px #3B82F6',
      },
    },
  },
  plugins: [],
}
