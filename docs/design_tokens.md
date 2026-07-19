# TribeOS Design Tokens

**Status:** Approved v1.0

**Purpose:** Companion to [`design_system.md`](./design_system.md). Defines **semantic design tokens** so the app never hardcodes raw hex values (e.g. `#F04E37`). Code references semantic names (`bg-primary`, `text-muted`, `border-border`); a single token definition change re-themes the whole app.

> Raw palette values live in `design_system.md`. This file maps those values to stable semantic names and shows how to wire them into CSS variables + the Tailwind theme (shadcn/ui compatible). The snippets below are **reference specifications** for the frontend scaffold, not application code to generate now.

---

## Principles

1. Never hardcode hex values in components. Use semantic tokens only.
2. Tokens are defined once as CSS variables and consumed via the Tailwind theme.
3. Semantic names describe **role**, not appearance (`surface`, not `dark-gray`).
4. Changing brand or theme = editing token values in one place.
5. Token names are shadcn/ui-compatible so generated components map cleanly.

---

## Token Reference

### Surfaces & Structure

| Token | Hex | design_system role | Example utility |
| --- | --- | --- | --- |
| `--background` | `#000000` | Background / Primary | `bg-background` |
| `--surface` | `#111111` | Background / Secondary | `bg-surface` |
| `--surface-raised` | `#18181B` | Background / Tertiary | `bg-surface-raised` |
| `--card` | `#1F1F23` | Card | `bg-card` |
| `--hover` | `#2A2A2F` | Hover | `hover:bg-hover` |
| `--border` | `#303036` | Border | `border-border` |
| `--divider` | `#3A3A40` | Divider | `divide-divider` |
| `--input` | `#303036` | Input border | `border-input` |
| `--ring` | `#F04E37` | Focus ring (brand) | `ring-ring` |

### Brand

| Token | Hex | design_system role | Example utility |
| --- | --- | --- | --- |
| `--primary` | `#F04E37` | Brand / Primary | `bg-primary` |
| `--primary-hover` | `#D84531` | Brand / Hover | `hover:bg-primary-hover` |
| `--primary-light` | `#FF6A54` | Brand / Light | `text-primary-light` |
| `--primary-foreground` | `#FFFFFF` | Text on brand | `text-primary-foreground` |

### Text / Foreground

| Token | Hex | design_system role | Example utility |
| --- | --- | --- | --- |
| `--foreground` | `#FFFFFF` | Text / Primary | `text-foreground` |
| `--foreground-secondary` | `#C9C9C9` | Text / Secondary | `text-foreground-secondary` |
| `--muted` | `#8B8B8B` | Text / Muted | `text-muted` |
| `--disabled` | `#666666` | Text / Disabled | `text-disabled` |
| `--inverse` | `#000000` | Text / Inverse | `text-inverse` |

### Status

| Token | Hex | design_system role | Example utility |
| --- | --- | --- | --- |
| `--success` | `#22C55E` | Status / Success | `text-success` |
| `--warning` | `#F59E0B` | Status / Warning | `text-warning` |
| `--danger` | `#EF4444` | Status / Danger | `text-danger` |
| `--info` | `#3B82F6` | Status / Info | `text-info` |

> `--destructive` is an alias of `--danger` for shadcn/ui compatibility.

---

## Radius Tokens

| Token | Value |
| --- | --- |
| `--radius-sm` | `6px` |
| `--radius-md` | `10px` |
| `--radius-lg` | `14px` |
| `--radius-xl` | `18px` |

---

## CSS Variables (reference)

Define tokens once on the dark-first root (TribeOS is dark by default):

```css
:root {
  /* Surfaces */
  --background: #000000;
  --surface: #111111;
  --surface-raised: #18181b;
  --card: #1f1f23;
  --hover: #2a2a2f;
  --border: #303036;
  --divider: #3a3a40;
  --input: #303036;
  --ring: #f04e37;

  /* Brand */
  --primary: #f04e37;
  --primary-hover: #d84531;
  --primary-light: #ff6a54;
  --primary-foreground: #ffffff;

  /* Text */
  --foreground: #ffffff;
  --foreground-secondary: #c9c9c9;
  --muted: #8b8b8b;
  --disabled: #666666;
  --inverse: #000000;

  /* Status */
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --destructive: #ef4444;
  --info: #3b82f6;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
}
```

---

## Tailwind Theme Mapping (reference)

Map tokens into the Tailwind theme so semantic utility classes work everywhere:

```ts
// tailwind.config.ts (excerpt)
export default {
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
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
} satisfies import("tailwindcss").Config;
```

---

## Usage Rules

- ✅ `className="bg-card text-foreground border border-border rounded-lg"`
- ❌ `className="bg-[#1F1F23] text-white border-[#303036]"`
- ✅ Financial values: positive → `text-success`, negative → `text-danger`.
- ✅ Focus states use `ring-ring` (brand orange).
- Any new color need must first be added here as a semantic token — never introduced ad hoc in a component.

---

## Status

**APPROVED**

This document is authoritative for how design values are consumed in code. All frontend implementation must use these semantic tokens.
