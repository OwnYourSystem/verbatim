/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "selector",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF8F3",
        paper: "#FFFFFF",
        ink: "#3B3A45",
        "ink-soft": "#8D889B",
      },
    },
  },
  plugins: [
    // scrollbar-none utility for the mobile nav strip
    function ({ addUtilities }) {
      addUtilities({
        ".scrollbar-none": {
          "-ms-overflow-style": "none",
          "scrollbar-width": "none",
          "&::-webkit-scrollbar": { display: "none" },
        },
      });
    },
  ],
};
