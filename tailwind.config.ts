import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./providers/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.25rem",
        sm: "1.5rem",
        lg: "2rem",
        xl: "2.5rem",
      },
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0a0a0a",
          soft: "#141414",
          muted: "#1c1c1c",
        },
        accent: {
          DEFAULT: "#66BAFF",
          dark: "#3DA8F5",
          soft: "#99D4FF",
          muted: "#E8F5FF",
        },
        paper: {
          DEFAULT: "#ffffff",
          soft: "#f7f9fc",
          muted: "#eef2f7",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem",
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.03), 0 8px 32px rgba(0,0,0,0.05)",
        lift: "0 24px 64px -24px rgba(0,0,0,0.22)",
        glow: "0 8px 32px -8px rgba(102, 186, 255, 0.55)",
        "glow-sm": "0 4px 20px -4px rgba(102, 186, 255, 0.45)",
        panel: "0 0 0 1px rgba(10,10,10,0.06), 0 20px 48px -24px rgba(0,0,0,0.12)",
      },
      maxWidth: {
        "8xl": "1440px",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "pulse-accent": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "radar-ping": {
          "0%": { transform: "scale(0.85)", opacity: "0.55" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        "radar-sweep": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "card-laser-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        marquee: "marquee 22s linear infinite",
        "pulse-accent": "pulse-accent 2.5s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        "radar-ping": "radar-ping 2s cubic-bezier(0,0,0.2,1) infinite",
        "radar-sweep": "radar-sweep 2.4s linear infinite",
        "card-laser-spin": "card-laser-spin 2.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
