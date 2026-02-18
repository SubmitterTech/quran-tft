/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    fontFamily: {
      sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      serif: ['Lora', 'Times New Roman', 'Times', 'serif'],
      arabic: ['"Hafs"', '"Hafs UI"', "Arial", "sans-serif"],
      vazirmatn: ['"Vazirmatn"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    extend: {
      animation: {
        rotate: 'rotate 0.95s linear infinite',
      },
      keyframes: {
        rotate: {
          '0%': { transform: 'rotate(0deg) scale(19)' },
          '100%': { transform: 'rotate(-360deg) scale(19)' },
        },
      },
    },
  },
  plugins: [],
}
