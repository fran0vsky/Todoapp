import express from 'express';
import { supabase } from './supabase';

type TaskStatus = 'todo' | 'doing' | 'done';

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

const isTaskStatus = (value: unknown): value is TaskStatus =>
  value === 'todo' || value === 'doing' || value === 'done';

const app = express();
const port = process.env['PORT'] ?? 3333;

app.use(express.json());

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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// ---------- TASKS ----------

app.get('/api/tasks', async (_req, res) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, description, status')
    .eq('archived', false)
    .order('created_at', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

app.post('/api/tasks', async (req, res) => {
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

  const { data, error } = await supabase
    .from('tasks')
    .insert({ title, description, status })
    .select('id, title, description, status')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

app.patch('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params['id']);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid task id' });
    return;
  }

  const body = req.body as UpdateTaskBody;
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      res.status(400).json({ error: 'title must be a non-empty string' });
      return;
    }
    updates['title'] = body.title.trim();
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      res.status(400).json({ error: 'description must be a string' });
      return;
    }
    updates['description'] = body.description.trim();
  }

  if (body.status !== undefined) {
    if (!isTaskStatus(body.status)) {
      res.status(400).json({ error: 'status must be todo, doing, or done' });
      return;
    }
    updates['status'] = body.status;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'no fields to update' });
    return;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select('id, title, description, status')
    .single();

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({
      error: error.code === 'PGRST116' ? 'task not found' : error.message,
    });
    return;
  }
  res.json(data);
});

app.get('/api/tasks/archived', async (_req, res) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, description, status, created_at')
    .eq('archived', true)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

app.patch('/api/tasks/:id/restore', async (req, res) => {
  const id = Number(req.params['id']);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid task id' });
    return;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ archived: false })
    .eq('id', id)
    .select('id, title, description, status')
    .single();

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({
      error: error.code === 'PGRST116' ? 'task not found' : error.message,
    });
    return;
  }
  res.json(data);
});

app.patch('/api/tasks/:id/archive', async (req, res) => {
  const id = Number(req.params['id']);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid task id' });
    return;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ archived: true })
    .eq('id', id)
    .select('id')
    .single();

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({
      error: error.code === 'PGRST116' ? 'task not found' : error.message,
    });
    return;
  }
  res.json({ archived: true, id: data.id });
});

app.delete('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params['id']);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid task id' });
    return;
  }

  const { error } = await supabase.from('tasks').delete().eq('id', id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(204).send();
});

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
