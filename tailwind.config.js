/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          background: "#e5e7eb",
          panel: "#ffffff",
          border: "#dbe1ef",
          accent: "#2d5bff",
        },
      },
    },
  },
  plugins: [],
}
