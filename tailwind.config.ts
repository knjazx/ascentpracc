import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        cs: {
          dark: "#0a0a0a",
          panel: "#111111",
          hover: "#1a1a1a",
          card: "#111111",
          border: "#222222",
          borderStrong: "#ffffff",
          positive: "#10b981",
          negative: "#ef4444",
          gold: "#ffd700",
        },
        neutral: {
          50: "#fafafa",
          100: "#ffffff",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#222222",
          800: "#1a1a1a",
          900: "#111111",
          950: "#0a0a0a",
        },
      },
      boxShadow: {
        card: "0 10px 30px -10px rgba(0, 0, 0, 0.6)",
        "glow-p1": "0 0 20px -5px rgba(167, 139, 250, 0.45)",
        "glow-p2": "0 0 20px -5px rgba(45, 212, 191, 0.45)",
        "glow-amber": "0 0 20px -5px rgba(250, 204, 21, 0.45)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1", filter: "drop-shadow(0 0 10px rgba(255, 255, 255, 0.3))" },
          "50%": { opacity: "0.7", filter: "drop-shadow(0 0 4px rgba(255, 255, 255, 0.1))" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulseGlow 2s infinite ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
