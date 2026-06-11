import React, { useEffect, useState } from "react";
import {
  ScrollView, View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../api";
import type { TodayView } from "../types";
import { Card, StatusBadge, Empty, colors } from "../components/ui";

export default function TodayScreen() {
  const [data, setData] = useState<TodayView | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api.today().then(setData).catch((e) => setError(String(e)));

  useEffect(() => { load(); }, []);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setSaving(true);
    try {
      await api.createCheckIn({ notes, completed_task_ids: [...selected] });
      setSelected(new Set());
      setNotes("");
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Today · {data.day}</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        <Card title="Today's focus">
          {data.focus_system ? (
            <>
              <Text style={styles.systemName}>{data.focus_system.name}</Text>
              <Text style={styles.muted}>Priority {data.focus_system.current_priority ?? "—"}</Text>
              {data.focus_tasks.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.taskRow}
                  onPress={() => toggle(t.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, selected.has(t.id) && styles.checkboxChecked]} />
                  <Text style={[styles.taskTitle, selected.has(t.id) && styles.taskDone]}>
                    {t.title}
                  </Text>
                  <StatusBadge status={t.status} />
                </TouchableOpacity>
              ))}
              {data.focus_tasks.length === 0 && <Empty>No open tasks.</Empty>}
            </>
          ) : (
            <Empty>No focus system. Add a system and set its priority.</Empty>
          )}
        </Card>

        <Card title="Upcoming (next 7 days)">
          {data.upcoming_deadlines.map((t) => (
            <View key={t.id} style={styles.deadlineRow}>
              <Text style={styles.taskTitle}>{t.title}</Text>
              <Text style={styles.muted}>{t.deadline}</Text>
            </View>
          ))}
          {data.upcoming_deadlines.length === 0 && <Empty>Nothing due soon.</Empty>}
        </Card>

        <Card title="Flagged (overdue / blocked)">
          {data.flagged.map((t) => (
            <View key={t.id} style={styles.deadlineRow}>
              <Text style={[styles.taskTitle, { flex: 1 }]}>{t.title}</Text>
              <StatusBadge status={t.status} />
            </View>
          ))}
          {data.flagged.length === 0 && <Empty>Nothing flagged.</Empty>}
        </Card>

        <Card title="End-of-day check-in">
          <TextInput
            style={styles.textarea}
            multiline
            numberOfLines={3}
            placeholder="What got done today?"
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
          />
          <TouchableOpacity
            style={[styles.btn, saving && styles.btnDisabled]}
            onPress={submit}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>
              {saving ? "Saving…" : `Submit check-in (${selected.size} done)`}
            </Text>
          </TouchableOpacity>
        </Card>
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
  systemName: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  muted: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 8 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 2, borderColor: colors.textMuted,
  },
  checkboxChecked: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  taskTitle: { flex: 1, fontSize: 14, color: colors.textPrimary },
  taskDone: { textDecorationLine: "line-through", color: colors.textMuted },
  deadlineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  textarea: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 10,
    color: colors.textPrimary, fontSize: 14,
    minHeight: 72, textAlignVertical: "top",
    marginBottom: 10,
  },
  btn: {
    backgroundColor: colors.emerald, borderRadius: 8,
    paddingVertical: 12, alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  error: { color: colors.amber, fontSize: 13, marginBottom: 8 },
});
