/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Aliased primaries (keep old primary references working)
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        emerald: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#FA8112',
          600: '#EA7002',
          700: '#C95F00',
          800: '#A44D00',
          900: '#7C3D00',
          950: '#4A2400',
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
        // Deep Obsidian — now CSS-variable-driven for theme support
        obsidian: {
          DEFAULT: 'rgb(var(--obsidian-default) / <alpha-value>)',
          50: 'rgb(var(--obsidian-50) / <alpha-value>)',
          100: 'rgb(var(--obsidian-100) / <alpha-value>)',
          200: 'rgb(var(--obsidian-200) / <alpha-value>)',
          300: 'rgb(var(--obsidian-300) / <alpha-value>)',
          400: 'rgb(var(--obsidian-400) / <alpha-value>)',
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
          50: '#FAF3E1',
          100: '#F5E7C6',
          200: '#ead6aa',
          300: '#d3b788',
          400: '#a78a65',
          500: '#7a664b',
          600: '#5d4f3a',
          700: '#473d2e',
          800: '#322b21',
          900: '#222222',
        },
        // Neon accents
        neon: {
          cyan: '#00f0ff',
          magenta: '#ff00e5',
          amber: '#ffb800',
          red: '#ff3b5c',
          green: '#00ff88',
        },
        // Steel grayscale for text — CSS-variable-driven for theme support
        steel: {
          50: 'rgb(var(--steel-50) / <alpha-value>)',
          100: 'rgb(var(--steel-100) / <alpha-value>)',
          200: 'rgb(var(--steel-200) / <alpha-value>)',
          300: 'rgb(var(--steel-300) / <alpha-value>)',
          400: 'rgb(var(--steel-400) / <alpha-value>)',
          500: 'rgb(var(--steel-500) / <alpha-value>)',
          600: 'rgb(var(--steel-600) / <alpha-value>)',
          700: 'rgb(var(--steel-700) / <alpha-value>)',
        },
        // Theme-aware surface colors
        surface: {
          DEFAULT: 'rgb(var(--surface-primary) / <alpha-value>)',
          secondary: 'rgb(var(--surface-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--surface-tertiary) / <alpha-value>)',
          code: 'rgb(var(--surface-code) / <alpha-value>)',
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
          '0%, 100%': { 'box-shadow': '0 0 20px rgba(16, 185, 129, 0.15)' },
          '50%': { 'box-shadow': '0 0 40px rgba(16, 185, 129, 0.3)' },
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
        'glow-sm': '0 0 10px rgba(250, 129, 18, 0.2)',
        'glow': '0 0 20px rgba(250, 129, 18, 0.25)',
        'glow-lg': '0 0 40px rgba(250, 129, 18, 0.3)',
        'glow-lime': '0 0 20px rgba(34, 34, 34, 0.2)',
        'glow-red': '0 0 20px rgba(255, 59, 92, 0.2)',
        'glow-amber': '0 0 20px rgba(255, 184, 0, 0.2)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
        'card': '0 4px 24px -4px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 32px -4px rgba(0, 0, 0, 0.5), 0 0 20px rgba(250, 129, 18, 0.12)',
      },
    },
  },
  plugins: [],
}
