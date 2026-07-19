import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Semantic tokens only. Values are CSS variables defined in styles/globals.css
// (sourced from docs/design_tokens.md). Never hardcode raw hex in components.
export default {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
        },
        card: "var(--card)",
        hover: "var(--hover)",
        border: "var(--border)",
        divider: "var(--divider)",
        input: "var(--input)",
        ring: "var(--ring)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          light: "var(--primary-light)",
          foreground: "var(--primary-foreground)",
        },
        foreground: {
          DEFAULT: "var(--foreground)",
          secondary: "var(--foreground-secondary)",
        },
        muted: "var(--muted)",
        disabled: "var(--disabled)",
        inverse: "var(--inverse)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        destructive: "var(--destructive)",
        info: "var(--info)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [animate],
} satisfies Config;
