import type { ReactNode } from "react";
import { ME_BORDER, ME_INK, ME_SHADOW, ME_SURFACE } from "./tokens";

export function MeCard({
  children,
  tint,
  className = "",
  style,
}: {
  children: ReactNode;
  tint?: { bg: string; text: string };
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={`rounded-3xl border p-4 transition-transform duration-200 ${className}`}
      style={{
        background: tint?.bg ?? ME_SURFACE,
        color: tint?.text ?? ME_INK,
        borderColor: ME_BORDER,
        boxShadow: ME_SHADOW,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function MeSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-base font-extrabold tracking-tight mb-3" style={{ color: ME_INK }}>
      {children}
    </h2>
  );
}
