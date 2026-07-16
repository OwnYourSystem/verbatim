import type {
  AIProjectAssist,
  CheckIn,
  FocusBlock,
  IntakeAnswer,
  IntakeProposal,
  IntakeStep,
  Pain,
  PainDiscoveryItem,
  ProductProject,
  ProposalStatus,
  ReadingItem,
  RebalanceProposal,
  Report,
  SKFocusTask,
  SKRating,
  SKSuggestResponse,
  SpecificKnowledge,
  Sprint,
  Story,
  Subtask,
  System,
  SystemStatus,
  Task,
  TimeLog,
  TodayView,
  WorkItemInput,
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

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Incorrect username or password");
  const { access_token } = await res.json();
  setToken(access_token);
}

export const api = {
  // Dashboard
  today: () => request<TodayView>("/dashboard/today"),

  // Systems
  listSystems: () => request<System[]>("/systems"),
  createSystem: (body: { name: string; icon?: string; description?: string }) =>
    request<System>("/systems", { method: "POST", body: JSON.stringify(body) }),
  updateSystem: (id: number, body: Partial<{ name: string; icon: string | null; status: SystemStatus }>) =>
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
  createTask: (body: { system_id: number; title: string } & WorkItemInput) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: number, body: WorkItemInput & { system_id?: number }) =>
    request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTask: (id: number) => request<void>(`/tasks/${id}`, { method: "DELETE" }),

  // Subtasks
  listSubtasks: (taskId: number) =>
    request<Subtask[]>(`/subtasks?task_id=${taskId}`),
  createSubtask: (body: { task_id: number; title: string } & WorkItemInput) =>
    request<Subtask>("/subtasks", { method: "POST", body: JSON.stringify(body) }),
  updateSubtask: (id: number, body: WorkItemInput & { task_id?: number }) =>
    request<Subtask>(`/subtasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSubtask: (id: number) =>
    request<void>(`/subtasks/${id}`, { method: "DELETE" }),

  // Time logs (records hours spent → Report layer shows remaining)
  listTimeLogs: (params: { task_id?: number; subtask_id?: number }) => {
    const qs = new URLSearchParams();
    if (params.task_id != null) qs.set("task_id", String(params.task_id));
    if (params.subtask_id != null) qs.set("subtask_id", String(params.subtask_id));
    return request<TimeLog[]>(`/time-logs?${qs.toString()}`);
  },
  logTime: (body: {
    task_id?: number;
    subtask_id?: number;
    sk_id?: number;
    hours: number;
    day?: string | null;
    note?: string | null;
  }) => request<TimeLog>("/time-logs", { method: "POST", body: JSON.stringify(body) }),
  deleteTimeLog: (id: number) =>
    request<void>(`/time-logs/${id}`, { method: "DELETE" }),

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
    task_id?: number | null;
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

  // Specific Knowledge
  listSKs: () => request<SpecificKnowledge[]>("/specific-knowledges"),
  createSK: (body: { name: string; rating?: SKRating; ai_justification?: string }) =>
    request<SpecificKnowledge>("/specific-knowledges", { method: "POST", body: JSON.stringify(body) }),
  updateSK: (id: number, body: { name?: string; rating?: SKRating; rating_finalized?: boolean }) =>
    request<SpecificKnowledge>(`/specific-knowledges/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteSK: (id: number) =>
    request<void>(`/specific-knowledges/${id}`, { method: "DELETE" }),
  suggestSK: (title: string, description: string) =>
    request<SKSuggestResponse>("/specific-knowledges/suggest", {
      method: "POST",
      body: JSON.stringify({ title, description }),
    }),
  getSKFocusTasks: (skId: number) =>
    request<SKFocusTask[]>(`/specific-knowledges/${skId}/focus-tasks`),

  // Wall of Pains
  listPains: (area?: string) =>
    request<Pain[]>(`/pains${area && area !== "all" ? `?area=${area}` : ""}`),
  createPain: (body: Partial<Pain & { is_ai_fetched: boolean }>) =>
    request<Pain>("/pains", { method: "POST", body: JSON.stringify(body) }),
  deletePain: (id: number) =>
    request<void>(`/pains/${id}`, { method: "DELETE" }),
  discoverPains: (area = "all") =>
    request<PainDiscoveryItem[]>(`/pains/discover?area=${area}`, { method: "POST" }),
  createProject: (painId: number, body: object) =>
    request<Pain>(`/pains/${painId}/project`, { method: "POST", body: JSON.stringify(body) }),
  updateProject: (painId: number, body: object) =>
    request<Pain>(`/pains/${painId}/project`, { method: "PATCH", body: JSON.stringify(body) }),
  assistProject: (painId: number) =>
    request<AIProjectAssist>(`/pains/${painId}/assist-project`, { method: "POST" }),
  createSystemFromProject: (painId: number) =>
    request<Pain>(`/pains/${painId}/create-system`, { method: "POST" }),

  // Reading Items (Check Out ASAP)
  listReadingItems: (archived = false) =>
    request<ReadingItem[]>(`/reading-items?archived=${archived}`),
  createReadingItem: (body: { title: string; url?: string; description?: string }) =>
    request<ReadingItem>("/reading-items", { method: "POST", body: JSON.stringify(body) }),
  checkReadingItem: (id: number) =>
    request<ReadingItem>(`/reading-items/${id}`, { method: "PATCH", body: JSON.stringify({ is_checked: true }) }),
  deleteReadingItem: (id: number) =>
    request<void>(`/reading-items/${id}`, { method: "DELETE" }),

  // Product Development (Scrum)
  listProductProjects: () =>
    request<ProductProject[]>("/product-dev/projects"),
  getProductProject: (id: number) =>
    request<ProductProject>(`/product-dev/projects/${id}`),
  listStories: (projectId: number) =>
    request<Story[]>(`/product-dev/projects/${projectId}/stories`),
  createStory: (projectId: number, body: { title: string; description?: string; story_type?: string; points?: number; priority?: number }) =>
    request<Story>(`/product-dev/projects/${projectId}/stories`, { method: "POST", body: JSON.stringify(body) }),
  updateStory: (storyId: number, body: Partial<{ title: string; description: string | null; story_type: string; points: number | null; status: string; priority: number; sprint_id: number | null }>) =>
    request<Story>(`/product-dev/stories/${storyId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteStory: (storyId: number) =>
    request<void>(`/product-dev/stories/${storyId}`, { method: "DELETE" }),
  listSprints: (projectId: number) =>
    request<Sprint[]>(`/product-dev/projects/${projectId}/sprints`),
  createSprint: (projectId: number, body: { goal?: string; start_date?: string; end_date?: string }) =>
    request<Sprint>(`/product-dev/projects/${projectId}/sprints`, { method: "POST", body: JSON.stringify(body) }),
  updateSprint: (sprintId: number, body: Partial<{ goal: string; start_date: string; end_date: string; status: string }>) =>
    request<Sprint>(`/product-dev/sprints/${sprintId}`, { method: "PATCH", body: JSON.stringify(body) }),
};
