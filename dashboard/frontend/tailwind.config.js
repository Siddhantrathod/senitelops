/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Aliased primaries (keep old primary references working)
        primary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        // Keep slate references working but map to dark tones
        slate: {
          50: '#1a1f27',
          100: '#161b22',
          200: '#1e2530',
          300: '#2a3240',
          400: '#8b95a5',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#0B0E11',
        },
        dark: {
          50: '#1a1f27',
          100: '#161b22',
          200: '#12161c',
          300: '#0f1318',
          400: '#0B0E11',
          500: '#080a0d',
          600: '#050709',
          700: '#030405',
          800: '#010202',
          900: '#000000',
        },
        // Deep Obsidian
        obsidian: {
          DEFAULT: '#0B0E11',
          50: '#1a1f27',
          100: '#161b22',
          200: '#12161c',
          300: '#0f1318',
          400: '#0B0E11',
        },
        // Electric Cobalt
        violet: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21a8',
          900: '#581c87',
        },
        // Atomic Lime
        lime: {
          50: '#f3ffe6',
          100: '#e3ffc9',
          200: '#c8ff99',
          300: '#a3ff5e',
          400: '#7df52e',
          500: '#5ce60a',
          600: '#43b800',
          700: '#338b06',
          800: '#2c6d0c',
          900: '#275c0f',
        },
        // Neon accents
        neon: {
          cyan: '#00f0ff',
          magenta: '#ff00e5',
          amber: '#ffb800',
          red: '#ff3b5c',
          green: '#00ff88',
        },
        // Steel grayscale for text
        steel: {
          50: '#f8fafc',
          100: '#e2e8f0',
          200: '#cbd5e1',
          300: '#8b95a5',
          400: '#64748b',
          500: '#475569',
          600: '#334155',
          700: '#1e293b',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 8s linear infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'scan-line': 'scanLine 4s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { 'background-size': '200% 200%', 'background-position': 'left center' },
          '50%': { 'background-size': '200% 200%', 'background-position': 'right center' },
        },
        glow: {
          '0%, 100%': { 'box-shadow': '0 0 20px rgba(168, 85, 247, 0.15)' },
          '50%': { 'box-shadow': '0 0 40px rgba(168, 85, 247, 0.3)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { 'background-position': '-200% 0' },
          '100%': { 'background-position': '200% 0' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(168, 85, 247, 0.15)',
        'glow': '0 0 20px rgba(168, 85, 247, 0.2)',
        'glow-lg': '0 0 40px rgba(168, 85, 247, 0.25)',
        'glow-lime': '0 0 20px rgba(92, 230, 10, 0.2)',
        'glow-red': '0 0 20px rgba(255, 59, 92, 0.2)',
        'glow-amber': '0 0 20px rgba(255, 184, 0, 0.2)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
        'card': '0 4px 24px -4px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 32px -4px rgba(0, 0, 0, 0.5), 0 0 20px rgba(168, 85, 247, 0.1)',
      },
    },
  },
  plugins: [],
}
