/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    fontFamily: {
      serif: ['Lora', 'Times New Roman', 'Times', 'serif'],
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
