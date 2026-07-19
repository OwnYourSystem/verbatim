/**
 * Verbatim API client for React Native.
 * Mirrors the web frontend/src/api.ts — same endpoints, same types.
 * BASE_URL is set via app.json / env; default points to local backend.
 */

import type {
  TodayView,
  System,
  Task,
  FocusBlock,
  RebalanceProposal,
  Report,
  IntakeAnswer,
  IntakeStep,
  IntakeProposal,
  CheckIn,
} from "../types";

// In dev: your machine's LAN IP or ngrok tunnel.
// In prod: the Cloud Run URL.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // Dashboard
  today: () => request<TodayView>("/dashboard/today"),

  // Systems
  listSystems: () => request<System[]>("/systems"),
  createSystem: (body: { name: string; description?: string }) =>
    request<System>("/systems", { method: "POST", body: JSON.stringify(body) }),
  deleteSystem: (id: number) => request<void>(`/systems/${id}`, { method: "DELETE" }),
  setPriority: (id: number, year: number, month: number, score: number) =>
    request<unknown>(`/systems/${id}/priorities`, {
      method: "PUT",
      body: JSON.stringify({ system_id: id, year, month, score }),
    }),

  // Tasks
  listTasks: (systemId?: number) =>
    request<Task[]>(`/tasks${systemId ? `?system_id=${systemId}` : ""}`),

  // Focus blocks
  listFocusBlocks: () => request<FocusBlock[]>("/focus-blocks"),
  createFocusBlock: (body: { day: string; system_id?: number | null; note?: string | null }) =>
    request<FocusBlock>("/focus-blocks", { method: "POST", body: JSON.stringify(body) }),

  // Check-ins
  createCheckIn: (body: { notes?: string; completed_task_ids: number[] }) =>
    request<CheckIn>("/check-ins", { method: "POST", body: JSON.stringify(body) }),

  // Proposals
  listProposals: () => request<RebalanceProposal[]>("/rebalance-proposals?status=pending"),
  approveProposal: (id: number) =>
    request<RebalanceProposal>(`/rebalance-proposals/${id}/approve`, { method: "POST" }),
  rejectProposal: (id: number) =>
    request<RebalanceProposal>(`/rebalance-proposals/${id}/reject`, { method: "POST" }),

  // Intake
  intakeNext: (history: IntakeAnswer[]) =>
    request<IntakeStep>("/intake/next", { method: "POST", body: JSON.stringify({ history }) }),
  intakeCommit: (proposal: IntakeProposal) =>
    request<System>("/intake/commit", { method: "POST", body: JSON.stringify(proposal) }),

  // Reports
  report: (kind: "weekly" | "monthly" | "on-demand" | "morning-briefing") =>
    request<Report>(`/reports/${kind}`),
};
