/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Core Deep Navy / Void Developer Palette
        void: '#07090e',
        deep: '#0a0d14',
        surface: '#0f1420',
        elevated: '#151b2a',
        overlay: '#1b2336',
        
        // Semantic Tokens
        background: '#07090e',
        border: 'rgba(255, 255, 255, 0.08)',
        'border-strong': 'rgba(255, 255, 255, 0.16)',
        'border-cyan': 'rgba(34, 211, 238, 0.3)',
        'border-violet': 'rgba(168, 85, 247, 0.3)',
        
        'text-primary': '#f1f5f9',
        'text-secondary': '#94a3b8',
        'text-muted': '#64748b',

        // Precision Accent colors: Cyan & Violet
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          glow: 'rgba(34, 211, 238, 0.15)',
        },
        violet: {
          400: '#a855f7',
          500: '#8b5cf6',
          glow: 'rgba(168, 85, 247, 0.15)',
        },
        accent: '#22d3ee',
        'accent-violet': '#a855f7',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#f43f5e',
        hover: 'rgba(255, 255, 255, 0.04)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'Consolas', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in',
        'slide-in': 'slideIn 0.3s ease-out',
        'radar-scan': 'radarScan 6s linear infinite',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'float-slow': 'floatSlow 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        radarScan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(250%)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.85' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
