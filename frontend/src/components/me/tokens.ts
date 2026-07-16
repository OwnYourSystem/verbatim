/** ME-style design tokens — soft, pastel, coach-like. Scoped to the app shell
 *  (DateHeader, BottomNavBar) and the Today page for this first redesign pass;
 *  other pages keep the existing dark "Cosmos" theme until migrated. */

export const ME_BG = "#FBF8F3";
export const ME_INK = "#3B3A45";
export const ME_INK_SOFT = "#8D889B";
export const ME_BORDER = "rgba(60, 50, 40, 0.07)";
export const ME_SHADOW = "0 10px 30px rgba(60, 50, 40, 0.08)";

export const ME_ACCENT = "#FF8964";
export const ME_ACCENT_DARK = "#F06A46";
export const ME_TEAL = "#4FBFA8";

export interface Pastel {
  name: string;
  bg: string;
  text: string;
  ring: string;
}

export const PASTELS: Pastel[] = [
  { name: "mint", bg: "#E3F5EC", text: "#1F6B4A", ring: "#B7E4CE" },
  { name: "lavender", bg: "#ECE7FA", text: "#4A3E86", ring: "#CBC0F0" },
  { name: "peach", bg: "#FDECDD", text: "#92471B", ring: "#F7C9A6" },
  { name: "sky", bg: "#E3F1FB", text: "#205A8C", ring: "#BEE0F7" },
  { name: "blush", bg: "#FBE7EE", text: "#99315C", ring: "#F3C2D6" },
  { name: "butter", bg: "#FCF3D6", text: "#8A6D12", ring: "#F3E19E" },
];

export function pastelFor(index: number): Pastel {
  return PASTELS[index % PASTELS.length];
}
