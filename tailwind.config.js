/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0a0d12',
        surface: '#111620',
        'surface-elevated': '#161d2b',
        border: '#1f293d',
        'border-highlight': '#2d3b55',
        primary: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          subtle: 'rgba(59, 130, 246, 0.1)'
        },
        danger: {
          DEFAULT: '#ef4444',
          subtle: 'rgba(239, 68, 68, 0.15)'
        },
        warning: {
          DEFAULT: '#f59e0b',
          subtle: 'rgba(245, 158, 11, 0.15)'
        },
        success: {
          DEFAULT: '#10b981',
          subtle: 'rgba(16, 185, 129, 0.15)'
        },
        accent: {
          DEFAULT: '#8b5cf6',
          subtle: 'rgba(139, 92, 246, 0.15)'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}

