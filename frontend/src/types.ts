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

/** Shared, fully-editable work-item attributes (Task & Subtask).
 *  Priority: 1 = highest, 5 = lowest. */
export interface WorkItemFields {
  title: string;
  description: string | null;
  status: WorkStatus;
  priority: number;
  deadline: string | null;
  dedicated_hours: number;
  data_exposure_concern: boolean;
  last_checkpoint: string | null;
  required_demo: boolean;
  flagged: boolean;
  position: number;
  // server-computed, read-only
  spent_hours: number;
  remaining_hours: number;
  time_left_days: number | null;
}

export interface Task extends WorkItemFields {
  id: number;
  system_id: number;
  created_at: string;
  updated_at: string;
}

export interface Subtask extends WorkItemFields {
  id: number;
  task_id: number;
  created_at: string;
  updated_at: string;
  inherited_priority: number | null;
}

/** Editable subset for create/update payloads. */
export type WorkItemInput = Partial<{
  title: string;
  description: string | null;
  status: WorkStatus;
  priority: number;
  deadline: string | null;
  dedicated_hours: number;
  data_exposure_concern: boolean;
  last_checkpoint: string | null;
  required_demo: boolean;
  flagged: boolean;
  position: number;
}>;

export interface TimeLog {
  id: number;
  task_id: number | null;
  subtask_id: number | null;
  hours: number;
  day: string;
  note: string | null;
  created_at: string;
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
  task_title: string | null;
  system_name: string | null;
}

export const CHECKPOINTS = [
  "Planning",
  "Development",
  "Testing",
  "Staging",
  "Production",
] as const;

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
  type:
    | "reorder"
    | "add_pretask"
    | "add_task"
    | "update_task"
    | "add_subtask"
    | "schedule"
    | "insight";
  task_id?: number;
  position?: number;
  title?: string;
  priority?: number;
  deadline?: string | null;
  dedicated_hours?: number;
  data_exposure_concern?: boolean;
  last_checkpoint?: string | null;
  required_demo?: boolean;
  status?: WorkStatus;
  description?: string | null;
  day?: string;
  note?: string | null;
  kind?: "risk" | "blocker" | "estimate" | "suggestion" | "ceremony";
  message?: string;
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
  description?: string | null;
  status?: WorkStatus;
  priority?: number;
  deadline?: string | null;
  dedicated_hours?: number;
  data_exposure_concern?: boolean;
  last_checkpoint?: string | null;
  required_demo?: boolean;
}

export interface ProposedTask {
  title: string;
  description?: string | null;
  status?: WorkStatus;
  priority?: number;
  deadline?: string | null;
  dedicated_hours?: number;
  data_exposure_concern?: boolean;
  last_checkpoint?: string | null;
  required_demo?: boolean;
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

export interface ReportSection {
  heading: string;
  items: string[];
}

export type ChartType = "bar" | "pie" | "waterfall" | "line";

export interface ChartPoint {
  label: string;
  value: number;
  secondary?: number | null;
  color?: string | null;
}

export interface Chart {
  type: ChartType;
  title: string;
  unit?: string | null;
  points: ChartPoint[];
}

export interface Report {
  type: string;
  title: string;
  generated_at: string;
  summary: string;
  sections: ReportSection[];
  charts: Chart[];
}
