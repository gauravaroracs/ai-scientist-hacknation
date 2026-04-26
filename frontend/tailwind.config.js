/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#f8fafc',
        surface:  '#ffffff',
        surface2: '#f1f5f9',
        border:   '#e2e8f0',
        accent:   '#1d4ed8',
        'accent-light': '#eff6ff',
        teal:     '#0891b2',
        'teal-light': '#ecfeff',
        success:  '#059669',
        'success-light': '#ecfdf5',
        warning:  '#d97706',
        'warning-light': '#fffbeb',
        danger:   '#dc2626',
        'danger-light': '#fef2f2',
        ink:      '#0f172a',
        body:     '#334155',
        muted:    '#64748b',
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans:    ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)',
        focus: '0 0 0 3px rgba(29,78,216,0.15)',
      },
    },
  },
  plugins: [],
}
