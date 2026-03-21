export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
}

