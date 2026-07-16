import type { ReactNode } from "react";
import { ME_ACCENT, ME_ACCENT_DARK, ME_INK } from "./tokens";

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold
        text-white transition-all duration-200 active:scale-[0.97]
        disabled:opacity-50 disabled:pointer-events-none ${className}`}
      style={{
        background: `linear-gradient(135deg, ${ME_ACCENT}, ${ME_ACCENT_DARK})`,
        boxShadow: "0 8px 20px rgba(255,137,100,0.35)",
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold
        transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${className}`}
      style={{ background: "rgba(60,50,40,0.06)", color: ME_INK }}
    >
      {children}
    </button>
  );
}
