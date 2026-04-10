import express from 'express';
import { supabase } from './supabase';

type TaskStatus = 'todo' | 'doing' | 'done';

type CreateProjectBody = {
  name?: unknown;
};

type CreateTaskBody = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  assignee_email?: unknown;
  estimate?: unknown;
  project_id?: unknown;
};

type UpdateTaskBody = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  assignee_email?: unknown;
  estimate?: unknown;
};

const FIB_ESTIMATES = new Set<number>([1, 2, 3, 5, 8]);

const parseEstimate = (
  value: unknown
): { ok: true; value: number | null } | { ok: false; error: string } => {
  if (value === undefined) {
    return { ok: true, value: null };
  }
  if (value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { ok: false, error: 'estimate must be an integer, null, or omitted' };
  }
  if (!FIB_ESTIMATES.has(value)) {
    return { ok: false, error: 'estimate must be one of 1, 2, 3, 5, 8' };
  }
  return { ok: true, value };
};

const isSimpleEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

// ---------- USERS (for task assignment picker; requires service-role Supabase key) ----------

app.get('/api/users', async (_req, res) => {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  const emails = (data.users ?? [])
    .map((u) => u.email)
    .filter((e): e is string => typeof e === 'string' && e.length > 0)
    .sort((a, b) => a.localeCompare(b));
  res.json({ emails });
});

// ---------- PROJECTS ----------

app.get('/api/projects', async (_req, res) => {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

app.get('/api/projects/:id', async (req, res) => {
  const id = Number(req.params['id']);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid project id' });
    return;
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, created_at')
    .eq('id', id)
    .single();

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({
      error: error.code === 'PGRST116' ? 'project not found' : error.message,
    });
    return;
  }
  res.json(data);
});

app.post('/api/projects', async (req, res) => {
  const body = req.body as CreateProjectBody;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({ name })
    .select('id, name, created_at')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

// ---------- TASKS ----------

app.get('/api/tasks', async (req, res) => {
  const projectId = Number(req.query['projectId']);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    res.status(400).json({ error: 'projectId query parameter is required' });
    return;
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, description, status, assignee_email, estimate, project_id')
    .eq('archived', false)
    .eq('project_id', projectId)
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

  let assigneeEmail: string | null = null;
  if (body.assignee_email !== undefined && body.assignee_email !== null) {
    if (typeof body.assignee_email !== 'string') {
      res.status(400).json({ error: 'assignee_email must be a string or null' });
      return;
    }
    const trimmed = body.assignee_email.trim();
    if (trimmed === '') {
      assigneeEmail = null;
    } else if (!isSimpleEmail(trimmed)) {
      res.status(400).json({ error: 'assignee_email must be a valid email' });
      return;
    } else {
      assigneeEmail = trimmed;
    }
  }

  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (!isTaskStatus(status)) {
    res.status(400).json({ error: 'status must be todo, doing, or done' });
    return;
  }

  const est = parseEstimate(body.estimate);
  if (est.ok === false) {
    res.status(400).json({ error: est.error });
    return;
  }

  const insertRow: Record<string, unknown> = { title, description, status };
  if (assigneeEmail !== null) {
    insertRow['assignee_email'] = assigneeEmail;
  }
  if (est.value !== null) {
    insertRow['estimate'] = est.value;
  }

  const projectId = body.project_id;
  if (typeof projectId !== 'number' || !Number.isInteger(projectId) || projectId <= 0) {
    res.status(400).json({ error: 'project_id must be a positive integer' });
    return;
  }
  insertRow['project_id'] = projectId;

  const { data, error } = await supabase
    .from('tasks')
    .insert(insertRow)
    .select('id, title, description, status, assignee_email, estimate, project_id')
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

  if (body.assignee_email !== undefined) {
    if (body.assignee_email === null) {
      updates['assignee_email'] = null;
    } else if (typeof body.assignee_email === 'string') {
      const trimmed = body.assignee_email.trim();
      if (trimmed === '') {
        updates['assignee_email'] = null;
      } else if (!isSimpleEmail(trimmed)) {
        res.status(400).json({ error: 'assignee_email must be a valid email' });
        return;
      } else {
        updates['assignee_email'] = trimmed;
      }
    } else {
      res.status(400).json({ error: 'assignee_email must be a string or null' });
      return;
    }
  }

  if (body.estimate !== undefined) {
    const est = parseEstimate(body.estimate);
    if (est.ok === false) {
      res.status(400).json({ error: est.error });
      return;
    }
    updates['estimate'] = est.value;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'no fields to update' });
    return;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select('id, title, description, status, assignee_email, estimate, project_id')
    .single();

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({
      error: error.code === 'PGRST116' ? 'task not found' : error.message,
    });
    return;
  }
  res.json(data);
});

app.get('/api/tasks/archived', async (req, res) => {
  const projectId = Number(req.query['projectId']);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    res.status(400).json({ error: 'projectId query parameter is required' });
    return;
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, description, status, created_at, assignee_email, estimate, project_id')
    .eq('archived', true)
    .eq('project_id', projectId)
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
    .select('id, title, description, status, assignee_email, estimate, project_id')
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
