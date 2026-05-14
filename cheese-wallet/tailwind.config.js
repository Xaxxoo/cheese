/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#d4a843',
          light: '#f3d88a',
          dim: 'rgba(212,168,67,0.15)',
        },
      },
      fontFamily: {
        display:          ['var(--font-display)', 'serif'],
        body:             ['var(--font-body)', 'sans-serif'],
        mono:             ['var(--font-mono)', 'monospace'],
        merchant:         ['var(--merchant-font-sans)', 'sans-serif'],
        'merchant-serif': ['var(--merchant-font-display)', 'serif'],
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom, 0px)',
      },
      padding: {
        safe: 'env(safe-area-inset-bottom, 0px)',
      },
      animation: {
        'fade-up':    'fadeUp 0.6s ease-out forwards',
        'fade-in':    'fadeIn 0.3s ease-out forwards',
        'shimmer':    'shimmer 3s linear infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'marquee':    'marquee 22s linear infinite',
        'slide-in':   'slideIn 0.2s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '0% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212,168,67,0.4)' },
          '50%':       { boxShadow: '0 0 0 8px rgba(212,168,67,0)' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
