export enum TaskStatus {
  Todo = 'todo',
  Doing = 'doing',
  Done = 'done',
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  /** Set when a user is assigned; omitted or null when unassigned. */
  assignee_email?: string | null;
}

