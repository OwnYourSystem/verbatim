// Shared domain types — kept in sync with frontend/src/types.ts

export type WorkStatus = "todo" | "in_progress" | "blocked" | "done";
export type SystemStatus = "active" | "paused" | "archived";
export type ProposalStatus = "pending" | "approved" | "rejected";

export interface System {
  id: number;
  name: string;
  description: string | null;
  status: SystemStatus;
  purpose: string | null;
  goals: string | null;
  constraints: string | null;
  dependencies: string | null;
  delivery_expectations: string | null;
  created_at: string;
  updated_at: string;
  current_priority: number | null;
}

export interface Task {
  id: number;
  system_id: number;
  title: string;
  description: string | null;
  status: WorkStatus;
  deadline: string | null;
  position: number;
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  status: WorkStatus;
  position: number;
  inherited_priority: number | null;
}

export interface FocusBlock {
  id: number;
  day: string;
  start_time: string | null;
  end_time: string | null;
  system_id: number | null;
  task_id: number | null;
  note: string | null;
}

export interface TodayView {
  day: string;
  focus_system: System | null;
  focus_tasks: Task[];
  upcoming_deadlines: Task[];
  flagged: Task[];
}

export interface CheckIn {
  id: number;
  day: string;
  notes: string | null;
  completed_task_ids: number[];
}

export interface RebalanceProposal {
  id: number;
  system_id: number;
  trigger: string;
  summary: string;
  actions: ProposalAction[];
  status: ProposalStatus;
  created_at: string;
  decided_at: string | null;
}

export type ProposalAction =
  | { type: "reorder"; task_id: number; position: number }
  | { type: "add_pretask"; title: string; system_id: number };

export interface IntakeAnswer {
  question: string;
  answer: string;
}

export interface IntakeStep {
  done: boolean;
  question: string | null;
  proposal: IntakeProposal | null;
}

export interface IntakeProposal {
  system: Omit<System, "id" | "created_at" | "updated_at" | "current_priority">;
  tasks: ProposedTask[];
}

export interface ProposedTask {
  title: string;
  subtasks: { title: string }[];
}

export interface Report {
  type: string;
  title: string;
  generated_at: string;
  summary: string;
  sections: ReportSection[];
}

export interface ReportSection {
  heading: string;
  items: string[];
}
