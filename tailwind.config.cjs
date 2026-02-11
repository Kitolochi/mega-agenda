/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          0: '#0c0c0e',
          1: '#131316',
          2: '#1a1a1f',
          3: '#222228',
          4: '#2a2a32',
        },
        accent: {
          blue: '#6C8EEF',
          purple: '#A78BFA',
          rose: '#F472B6',
          emerald: '#34D399',
          amber: '#FBBF24',
          orange: '#FB923C',
          teal: '#2DD4BF',
          red: '#F87171',
        },
        muted: '#6b6b7b',
        subtle: '#3a3a46',
      },
      animation: {
        'check-pop': 'checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'ring-fill': 'ringFill 0.8s ease-out forwards',
        'voice-pulse': 'voicePulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        checkPop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        voicePulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(244, 114, 182, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(244, 114, 182, 0)' },
        },
        ringFill: {
          '0%': { strokeDashoffset: '251' },
          '100%': { strokeDashoffset: 'var(--ring-offset)' },
        },
      },
    },
  },
  plugins: [],
}
