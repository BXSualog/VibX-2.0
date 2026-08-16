/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        vibx: {
          primary: '#2563EB',
          accent: '#60A5FA',
          bg: '#0B1220',
          surface: '#111827',
          elevated: '#1F2937',
          text: '#F8FAFC',
          muted: '#94A3B8',
          highlight: '#3B82F6',
          success: '#22C55E',
          sky: '#7DD3FC',
          ice: '#E0F2FE',
        },
      },
    },
  },
  plugins: [],
};
