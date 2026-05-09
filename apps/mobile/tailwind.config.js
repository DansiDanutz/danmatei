/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f1f6ff",
          500: "#3b82f6",
          600: "#2563eb",
          900: "#0b1020",
        },
        ink: {
          DEFAULT: "#0b1020",
          muted: "#64748b",
        },
        surface: {
          DEFAULT: "#ffffff",
          dark: "#0b1020",
          card: "#f8fafc",
          cardDark: "#111827",
        },
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
        "3xl": "28px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
