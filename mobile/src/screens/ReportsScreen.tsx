import React, { useEffect, useState } from "react";
import {
  ScrollView, View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../api";
import type { Report } from "../types";
import { Card, colors } from "../components/ui";

type Kind = "weekly" | "monthly" | "on-demand";
const TABS: Kind[] = ["weekly", "monthly", "on-demand"];

export default function ReportsScreen() {
  const [kind, setKind] = useState<Kind>("weekly");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReport(null);
    api.report(kind).then(setReport).catch((e) => setError(String(e)));
  }, [kind]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Reports</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, kind === t && styles.tabActive]}
              onPress={() => setKind(t)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, kind === t && styles.tabTextActive]}>
                {t.replace("-", " ")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!report ? (
          <ActivityIndicator color={colors.emerald} style={{ marginTop: 32 }} />
        ) : (
          <Card title={report.title}>
            <Text style={styles.summary}>{report.summary}</Text>
            <Text style={styles.ts}>Generated {report.generated_at}</Text>
            {report.sections.map((s, i) => (
              <View key={i} style={styles.section}>
                <Text style={styles.sectionHeading}>{s.heading.toUpperCase()}</Text>
                {s.items.map((item, j) => (
                  <Text key={j} style={styles.item}>• {item}</Text>
                ))}
              </View>
            ))}
          </Card>
        )}

        {/* Morning briefing */}
        <Card title="Morning briefing">
          <Text style={styles.summary}>
            Tap below to load today's briefing from the server.
          </Text>
          <TouchableOpacity
            style={styles.briefingBtn}
            onPress={() => api.report("morning-briefing").then(setReport).catch((e) => setError(String(e)))}
            activeOpacity={0.8}
          >
            <Text style={styles.briefingBtnText}>Show briefing</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 16 },
  tabs: { flexDirection: "row", gap: 6, marginBottom: 16 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, backgroundColor: "#1e293b",
  },
  tabActive: { backgroundColor: "#334155" },
  tabText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  tabTextActive: { color: colors.textPrimary },
  summary: { fontSize: 14, color: "#cbd5e1" },
  ts: { fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: 12 },
  section: { marginTop: 12 },
  sectionHeading: {
    fontSize: 10, fontWeight: "700", letterSpacing: 1,
    color: colors.textMuted, marginBottom: 4,
  },
  item: { fontSize: 13, color: colors.textPrimary, marginBottom: 2 },
  briefingBtn: {
    marginTop: 10, backgroundColor: colors.emerald,
    borderRadius: 8, paddingVertical: 10, alignItems: "center",
  },
  briefingBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  error: { color: colors.amber, fontSize: 13, marginBottom: 8 },
});
