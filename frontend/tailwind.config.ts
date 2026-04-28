import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#FDF5F0",
          100: "#FAE8DF",
          200: "#F4CEBB",
          300: "#EBB090",
          400: "#DE8E68",
          500: "#CF7250",
          600: "#B8785A",
          700: "#9E6349",
          800: "#854F38",
          900: "#6C3D28",
        },
        warm: {
          50: "#FEF9F3",
          100: "#FDF0E0",
          200: "#FAE0C0",
          300: "#F5CC98",
          400: "#EDB870",
          500: "#D4A574",
          600: "#C08B58",
          700: "#A37040",
          800: "#875A30",
          900: "#6C4520",
        },
        chalk: {
          50: "#FAF7F3",
          100: "#F4EDE2",
          200: "#E9DACC",
          300: "#D9C4B0",
          400: "#C9AD93",
          500: "#C4A882",
          600: "#B09068",
          700: "#9A7852",
          800: "#7E6040",
          900: "#634B30",
        },
        surface: {
          50: "#FAF6F1",
          100: "#F5EDE4",
          200: "#E8DDD0",
          300: "#D8CDC0",
          400: "#B8A898",
          500: "#8A7A6A",
          600: "#7A6A5A",
          700: "#6A5A4A",
          800: "#5A5048",
          900: "#4A4038",
          950: "#3A3028",
        },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans", "system-ui", "sans-serif"],
        serif: ["Literata", "Georgia", "Noto Serif", "serif"],
      },
      borderRadius: {
        pill: "24px",
      },
    },
  },
  plugins: [],
} satisfies Config;
