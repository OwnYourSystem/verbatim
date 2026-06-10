export type WorkStatus = "todo" | "in_progress" | "blocked" | "done";
export type SystemStatus = "active" | "paused" | "archived";

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
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  status: WorkStatus;
  position: number;
  created_at: string;
  updated_at: string;
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
  created_at: string;
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
  created_at: string;
}

export type ProposalStatus = "pending" | "approved" | "rejected";

export interface ProposalAction {
  type: "reorder" | "add_pretask";
  task_id?: number;
  position?: number;
  title?: string;
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

export interface IntakeAnswer {
  question: string;
  answer: string;
}

export interface ProposedSubtask {
  title: string;
}

export interface ProposedTask {
  title: string;
  deadline?: string | null;
  subtasks: ProposedSubtask[];
}

export interface IntakeSystemFields {
  name: string;
  purpose?: string | null;
  goals?: string | null;
  constraints?: string | null;
  dependencies?: string | null;
  delivery_expectations?: string | null;
}

export interface IntakeProposal {
  system: IntakeSystemFields;
  tasks: ProposedTask[];
}

export interface IntakeStep {
  done: boolean;
  question?: string | null;
  proposal?: IntakeProposal | null;
}
