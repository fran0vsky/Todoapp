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
}

