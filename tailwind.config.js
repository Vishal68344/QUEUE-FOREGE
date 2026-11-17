/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { ink: '#070d1c', panel: '#0e172d', line: '#1c2a4a', electric: { DEFAULT: '#2f7bff', soft: '#6aa3ff' } },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'monospace'] },
    },
  },
  plugins: [],
}
