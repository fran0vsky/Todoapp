import express from 'express';

type TaskStatus = 'todo' | 'doing' | 'done';

type Task = {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
};

type CreateTaskBody = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
};

type UpdateTaskBody = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
};

const app = express();
const port = process.env.PORT ?? 3333;

app.use(express.json());

// Allow local frontend dev server access.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

const tasks: Task[] = [];
let nextId = 1;

const isTaskStatus = (value: unknown): value is TaskStatus =>
  value === 'todo' || value === 'doing' || value === 'done';

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const body = req.body as CreateTaskBody;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description =
    typeof body.description === 'string' ? body.description.trim() : '';
  const status = body.status;

  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  if (!isTaskStatus(status)) {
    res.status(400).json({ error: 'status must be todo, doing, or done' });
    return;
  }

  const task: Task = {
    id: nextId++,
    title,
    description,
    status,
  };

  tasks.push(task);
  res.status(201).json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid task id' });
    return;
  }

  const task = tasks.find((t) => t.id === id);
  if (!task) {
    res.status(404).json({ error: 'task not found' });
    return;
  }

  const body = req.body as UpdateTaskBody;

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      res.status(400).json({ error: 'title must be a non-empty string' });
      return;
    }
    task.title = body.title.trim();
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      res.status(400).json({ error: 'description must be a string' });
      return;
    }
    task.description = body.description.trim();
  }

  if (body.status !== undefined) {
    if (!isTaskStatus(body.status)) {
      res.status(400).json({ error: 'status must be todo, doing, or done' });
      return;
    }
    task.status = body.status;
  }

  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid task id' });
    return;
  }

  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'task not found' });
    return;
  }

  tasks.splice(index, 1);
  res.status(204).send();
});

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
