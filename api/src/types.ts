export type TaskStatus = 'todo' | 'doing' | 'done';

export type CreateProjectBody = {
  name?: unknown;
};

export type CreateTaskBody = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  assignee_email?: unknown;
  estimate?: unknown;
  project_id?: unknown;
};

export type UpdateTaskBody = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  assignee_email?: unknown;
  estimate?: unknown;
};
