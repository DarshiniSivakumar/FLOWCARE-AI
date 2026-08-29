/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hospital: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#38a9f8',
          500: '#0e8de3',
          600: '#026fc1',
          700: '#03599c',
          800: '#084c81',
          900: '#0c406b',
          950: '#082847',
        }
      }
    },
  },
  plugins: [],
}
