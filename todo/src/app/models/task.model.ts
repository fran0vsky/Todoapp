export enum TaskStatus {
  Todo = 'todo',
  Doing = 'doing',
  Done = 'done',
}

/** Fibonacci scale for difficulty / effort estimation. */
export const FIBONACCI_ESTIMATES = [1, 2, 3, 5, 8] as const;
export type FibonacciEstimate = (typeof FIBONACCI_ESTIMATES)[number];

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: TaskStatus;
  /** Set when a user is assigned; omitted or null when unassigned. */
  assignee_email?: string | null;
  /** Story points (Fibonacci); omitted or null when not set. */
  estimate?: number | null;
}
