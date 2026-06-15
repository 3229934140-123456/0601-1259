/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        forge: {
          bg: '#1A1614',
          surface: '#241F1B',
          elevated: '#2E2824',
          border: '#3D3530',
          gold: '#D4A853',
          'gold-light': '#E8C87A',
          'gold-dark': '#B08930',
          parchment: '#F5E6C8',
          'parchment-dark': '#E8D5AE',
          crimson: '#8B3A3A',
          'crimson-light': '#A84D4D',
          text: '#F5E6C8',
          'text-secondary': '#A89880',
          'text-muted': '#6B5D4F',
        },
      },
      fontFamily: {
        display: ['MedievalSharp', 'cursive'],
        body: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
