import type {
  CheckIn,
  FocusBlock,
  IntakeAnswer,
  IntakeProposal,
  IntakeStep,
  ProposalStatus,
  RebalanceProposal,
  Report,
  Subtask,
  System,
  SystemStatus,
  Task,
  TodayView,
  WorkStatus,
} from "./types";

const BASE = "/api";

// ── Token storage ────────────────────────────────────────────────────────────

const TOKEN_KEY = "ma_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Core fetch ───────────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { headers, ...options });

  if (res.status === 401) {
    clearToken();
    // Signal the app to show login — simple page reload works for a SPA with a route guard
    window.location.href = "/login";
    throw new Error("Unauthenticated");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(password: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error("Incorrect password");
  const { access_token } = await res.json();
  setToken(access_token);
}

export const api = {
  // Dashboard
  today: () => request<TodayView>("/dashboard/today"),

  // Systems
  listSystems: () => request<System[]>("/systems"),
  createSystem: (body: { name: string; description?: string }) =>
    request<System>("/systems", { method: "POST", body: JSON.stringify(body) }),
  updateSystem: (id: number, body: Partial<{ name: string; status: SystemStatus }>) =>
    request<System>(`/systems/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSystem: (id: number) =>
    request<void>(`/systems/${id}`, { method: "DELETE" }),
  setPriority: (id: number, year: number, month: number, score: number) =>
    request<unknown>(`/systems/${id}/priorities`, {
      method: "PUT",
      body: JSON.stringify({ system_id: id, year, month, score }),
    }),

  // Tasks
  listTasks: (systemId?: number) =>
    request<Task[]>(`/tasks${systemId ? `?system_id=${systemId}` : ""}`),
  createTask: (body: {
    system_id: number;
    title: string;
    deadline?: string | null;
    status?: WorkStatus;
  }) => request<Task>("/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTask: (
    id: number,
    body: Partial<{ title: string; status: WorkStatus; deadline: string | null }>,
  ) => request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTask: (id: number) => request<void>(`/tasks/${id}`, { method: "DELETE" }),

  // Subtasks
  listSubtasks: (taskId: number) =>
    request<Subtask[]>(`/subtasks?task_id=${taskId}`),
  createSubtask: (body: { task_id: number; title: string }) =>
    request<Subtask>("/subtasks", { method: "POST", body: JSON.stringify(body) }),
  updateSubtask: (id: number, body: Partial<{ title: string; status: WorkStatus }>) =>
    request<Subtask>(`/subtasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSubtask: (id: number) =>
    request<void>(`/subtasks/${id}`, { method: "DELETE" }),

  // Calendar
  listFocusBlocks: (start?: string, end?: string) => {
    const qs = new URLSearchParams();
    if (start) qs.set("start", start);
    if (end) qs.set("end", end);
    const q = qs.toString();
    return request<FocusBlock[]>(`/focus-blocks${q ? `?${q}` : ""}`);
  },
  createFocusBlock: (body: {
    day: string;
    system_id?: number | null;
    note?: string | null;
  }) => request<FocusBlock>("/focus-blocks", { method: "POST", body: JSON.stringify(body) }),
  deleteFocusBlock: (id: number) =>
    request<void>(`/focus-blocks/${id}`, { method: "DELETE" }),

  // Check-ins
  createCheckIn: (body: { notes?: string; completed_task_ids: number[] }) =>
    request<CheckIn>("/check-ins", { method: "POST", body: JSON.stringify(body) }),

  // Rebalance proposals (AI brain)
  requestRebalance: (systemId: number) =>
    request<RebalanceProposal>(`/systems/${systemId}/rebalance`, { method: "POST" }),
  listProposals: (status?: ProposalStatus) =>
    request<RebalanceProposal[]>(
      `/rebalance-proposals${status ? `?status=${status}` : ""}`,
    ),
  approveProposal: (id: number) =>
    request<RebalanceProposal>(`/rebalance-proposals/${id}/approve`, { method: "POST" }),
  rejectProposal: (id: number) =>
    request<RebalanceProposal>(`/rebalance-proposals/${id}/reject`, { method: "POST" }),

  // AI intake interview
  intakeNext: (history: IntakeAnswer[]) =>
    request<IntakeStep>("/intake/next", {
      method: "POST",
      body: JSON.stringify({ history }),
    }),
  intakeCommit: (proposal: IntakeProposal) =>
    request<System>("/intake/commit", {
      method: "POST",
      body: JSON.stringify(proposal),
    }),

  // Reports
  report: (kind: "weekly" | "monthly" | "on-demand" | "morning-briefing") =>
    request<Report>(`/reports/${kind}`),
};
