/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#6d3af2',
        'accent-2': '#8f68ff',
        panel: '#f4f0ff',
      },
      fontFamily: { sans: ['"Space Grotesk"', 'Avenir Next', 'Segoe UI', 'sans-serif'] },
      borderRadius: { wizard: '14px' },
      boxShadow: { wizard: '0 10px 24px rgba(57,35,116,0.12)' },
    },
  },
};
