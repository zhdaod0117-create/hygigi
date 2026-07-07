import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#fffaf0",
          100: "#fff4de",
          200: "#ffe9bd",
        },
        brown: {
          400: "#b98a5e",
          500: "#9c6b41",
          600: "#7a5233",
          700: "#5c3d26",
          800: "#40291a",
        },
        butter: {
          100: "#fff6d9",
          200: "#ffedb0",
          300: "#ffe085",
        },
      },
      fontFamily: {
        pixel: ['"Courier New"', "monospace"],
      },
      keyframes: {
        // translateX(%) is relative to the element's own width, so crossing
        // the parent needs `left` (parent-relative) instead of a transform.
        // 96px = dog sprite width (COLS * PIXEL_SIZE in PixelRetriever.tsx)
        "walk-x": {
          "0%": { left: "0px" },
          "50%": { left: "calc(100% - 96px)" },
          "100%": { left: "0px" },
        },
        "walk-flip": {
          "0%, 49.9%": { transform: "scaleX(1)" },
          "50%, 99.9%": { transform: "scaleX(-1)" },
          "100%": { transform: "scaleX(1)" },
        },
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "walk-x": "walk-x 14s linear infinite",
        "walk-flip": "walk-flip 14s linear infinite",
        bob: "bob 0.6s ease-in-out infinite",
        "pop-in": "pop-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
