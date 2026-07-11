/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"]
      },
      colors: {
        brand: {
          navy: "#0d1b3e",
          red: "#e8001d",
          blue: "#1769ff",
          sky: "#f0f4ff"
        }
      },
      boxShadow: {
        soft: "0 18px 50px rgba(13, 27, 62, 0.14)",
        lift: "0 24px 70px rgba(13, 27, 62, 0.2)",
        red: "0 10px 24px rgba(232, 0, 29, 0.26)",
        "red-lg": "0 14px 34px rgba(232, 0, 29, 0.34)"
      }
    }
  },
  plugins: []
};
