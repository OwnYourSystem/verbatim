/** ME-style design tokens — soft, pastel, coach-like.
 *
 *  These reference CSS custom properties (defined in index.css, with light
 *  values under `:root` and dark overrides under `html.dark`) rather than
 *  literal hex — so every ME component automatically follows the active
 *  theme without needing its own light/dark branching logic. */

export const ME_BG = "var(--me-bg)";
export const ME_SURFACE = "var(--me-surface)";
export const ME_SURFACE_SOFT = "var(--me-surface-soft)";
export const ME_INK = "var(--me-ink)";
export const ME_INK_SOFT = "var(--me-ink-soft)";
export const ME_BORDER = "var(--me-border)";
export const ME_SHADOW = "var(--me-shadow)";
export const ME_OVERLAY = "var(--me-overlay)";
export const ME_INPUT_BG = "var(--me-input-bg)";
export const ME_CHIP_BG = "var(--me-chip-bg)";
export const ME_GHOST_BG = "var(--me-ghost-bg)";

export const ME_ACCENT = "var(--me-accent)";
export const ME_ACCENT_DARK = "var(--me-accent-dark)";
export const ME_TEAL = "var(--me-teal)";

export interface Pastel {
  name: string;
  bg: string;
  text: string;
}

export const PASTELS: Pastel[] = [
  { name: "mint", bg: "var(--me-pastel-mint-bg)", text: "var(--me-pastel-mint-text)" },
  { name: "lavender", bg: "var(--me-pastel-lavender-bg)", text: "var(--me-pastel-lavender-text)" },
  { name: "peach", bg: "var(--me-pastel-peach-bg)", text: "var(--me-pastel-peach-text)" },
  { name: "sky", bg: "var(--me-pastel-sky-bg)", text: "var(--me-pastel-sky-text)" },
  { name: "blush", bg: "var(--me-pastel-blush-bg)", text: "var(--me-pastel-blush-text)" },
  { name: "butter", bg: "var(--me-pastel-butter-bg)", text: "var(--me-pastel-butter-text)" },
];

export function pastelFor(index: number): Pastel {
  return PASTELS[index % PASTELS.length];
}
