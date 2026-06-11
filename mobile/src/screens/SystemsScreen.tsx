import React, { useEffect, useState } from "react";
import {
  ScrollView, View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../api";
import type { System, Task } from "../types";
import { Card, Empty, StatusBadge, colors } from "../components/ui";

export default function SystemsScreen() {
  const [systems, setSystems] = useState<System[]>([]);
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [taskMap, setTaskMap] = useState<Record<number, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () =>
    api.listSystems().then(setSystems).catch((e) => setError(String(e)));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const expand = async (id: number) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!taskMap[id]) {
      const tasks = await api.listTasks(id);
      setTaskMap((prev) => ({ ...prev, [id]: tasks }));
    }
  };

  const addSystem = async () => {
    if (!name.trim()) return;
    await api.createSystem({ name: name.trim() });
    setName("");
    load();
  };

  const rebalance = async (s: System) => {
    setNotice(null);
    try {
      await api.requestRebalance?.(s.id);
      setNotice(`Proposal created for "${s.name}". Review in Proposals.`);
    } catch (e) {
      setError(String(e));
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
        <Text style={styles.heading}>Systems</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        <Card title="Add a system">
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="System name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              onSubmitEditing={addSystem}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.btnSm} onPress={addSystem} activeOpacity={0.8}>
              <Text style={styles.btnSmText}>Add</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {systems.length === 0 && <Empty>No systems yet. Add one above.</Empty>}

        {systems.map((s) => (
          <Card key={s.id}>
            {/* Header row */}
            <View style={styles.systemHeader}>
              <TouchableOpacity onPress={() => expand(s.id)} style={styles.systemNameWrap}>
                <Text style={styles.chevron}>{openId === s.id ? "▾" : "▸"}</Text>
                <Text style={styles.systemName}>{s.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rebalanceBtn}
                onPress={() => rebalance(s)}
                activeOpacity={0.8}
              >
                <Text style={styles.rebalanceBtnText}>Rebalance</Text>
              </TouchableOpacity>
            </View>

            {/* Priority row */}
            <View style={styles.priorityRow}>
              <Text style={styles.muted}>Priority score:</Text>
              <Text style={styles.priorityVal}>
                {s.current_priority ?? "—"}
              </Text>
            </View>

            {/* Expanded tasks */}
            {openId === s.id && (
              <View style={styles.taskList}>
                {(taskMap[s.id] ?? []).map((t) => (
                  <View key={t.id} style={styles.taskRow}>
                    <Text style={styles.taskTitle}>{t.title}</Text>
                    {t.deadline && <Text style={styles.muted}>{t.deadline}</Text>}
                    <StatusBadge status={t.status} />
                  </View>
                ))}
                {(taskMap[s.id] ?? []).length === 0 && <Empty>No tasks.</Empty>}
              </View>
            )}
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
  heading: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 16 },
  row: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1, backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 10,
    color: colors.textPrimary, fontSize: 14,
  },
  btnSm: {
    backgroundColor: colors.blue, borderRadius: 8,
    paddingHorizontal: 14, justifyContent: "center",
  },
  btnSmText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  systemHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  systemNameWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  chevron: { color: colors.textMuted, fontSize: 14 },
  systemName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary, flex: 1 },
  rebalanceBtn: {
    backgroundColor: colors.violet, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  rebalanceBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  priorityRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  priorityVal: { color: colors.textPrimary, fontSize: 13 },
  muted: { color: colors.textMuted, fontSize: 12 },
  taskList: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  taskTitle: { flex: 1, fontSize: 14, color: colors.textPrimary },
  error: { color: colors.amber, fontSize: 13, marginBottom: 8 },
  notice: { color: "#34d399", fontSize: 13, marginBottom: 8 },
});
