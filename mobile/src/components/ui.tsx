import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import type { WorkStatus } from "../types";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
export const colors = {
  bg: "#0f172a",
  surface: "#1e293b",
  border: "#334155",
  textPrimary: "#f1f5f9",
  textMuted: "#94a3b8",
  emerald: "#059669",
  blue: "#2563eb",
  violet: "#7c3aed",
  amber: "#d97706",
  red: "#dc2626",
};

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({
  title,
  children,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.card, style]}>
      {title && <Text style={styles.cardTitle}>{title.toUpperCase()}</Text>}
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------
const badgeColors: Record<WorkStatus, string> = {
  todo: "#475569",
  in_progress: "#1d4ed8",
  blocked: "#b45309",
  done: "#15803d",
};

export function StatusBadge({ status }: { status: WorkStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: badgeColors[status] }]}>
      <Text style={styles.badgeText}>{status.replace("_", " ")}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
export function Empty({ children }: { children: string }) {
  return <Text style={styles.empty}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------
export function SectionHeader({ children }: { children: string }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.textMuted,
    marginBottom: 10,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 6,
  },
});
