/**
 * Design tokens for places Tailwind can't reach (OG images, emails, PDFs).
 * Keep in sync with the @theme block in app/globals.css.
 */
export const tokens = {
  colors: {
    black: "#0A0A0A",
    surface: "#141414",
    border: "#262626",
    white: "#FFFFFF",
    orange: "#FF5A1F",
    orangeHover: "#FF7A45",
    muted: "#A3A3A3",
    success: "#22C55E",
    danger: "#EF4444",
    warning: "#F59E0B",
  },
  radius: { card: "1rem" },
} as const;
