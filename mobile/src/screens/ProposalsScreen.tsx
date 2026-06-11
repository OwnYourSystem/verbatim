import React, { useEffect, useState } from "react";
import {
  ScrollView, View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../api";
import type { RebalanceProposal } from "../types";
import { Card, Empty, colors } from "../components/ui";

export default function ProposalsScreen() {
  const [proposals, setProposals] = useState<RebalanceProposal[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api.listProposals().then(setProposals).catch((e) => setError(String(e)));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const decide = async (id: number, approve: boolean) => {
    setBusy(id);
    try {
      await (approve ? api.approveProposal(id) : api.rejectProposal(id));
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Proposals</Text>
        <Text style={styles.sub}>Nothing applies until you approve.</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        {proposals.length === 0 && (
          <Empty>No pending proposals. Open a system and tap Rebalance.</Empty>
        )}

        {proposals.map((p) => (
          <Card key={p.id}>
            <Text style={styles.proposalSystem}>System #{p.system_id}</Text>
            <Text style={styles.proposalSummary}>{p.summary}</Text>
            <Text style={styles.trigger}>Trigger: {p.trigger}</Text>

            {p.actions.map((a, i) => (
              <Text key={i} style={styles.action}>
                → {a.type === "reorder"
                  ? `Move task #${a.task_id} to position ${a.position}`
                  : `Add pre-task: "${a.title}"`}
              </Text>
            ))}

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.approveBtn, busy === p.id && styles.btnDisabled]}
                onPress={() => decide(p.id, true)}
                disabled={busy === p.id}
                activeOpacity={0.8}
              >
                <Text style={styles.btnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectBtn, busy === p.id && styles.btnDisabled]}
                onPress={() => decide(p.id, false)}
                disabled={busy === p.id}
                activeOpacity={0.8}
              >
                <Text style={styles.btnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  content: { padding: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 },
  sub: { fontSize: 13, color: colors.textMuted, marginBottom: 16 },
  proposalSystem: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  proposalSummary: { fontSize: 14, color: "#cbd5e1", marginTop: 4 },
  trigger: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  action: { fontSize: 13, color: "#94a3b8", marginTop: 6 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  approveBtn: { flex: 1, backgroundColor: colors.emerald, borderRadius: 8, padding: 10, alignItems: "center" },
  rejectBtn: { flex: 1, backgroundColor: "#334155", borderRadius: 8, padding: 10, alignItems: "center" },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  error: { color: colors.amber, fontSize: 13, marginBottom: 8 },
});
