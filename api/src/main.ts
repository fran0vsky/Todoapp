import express from 'express';
import './supabase';
import { getAuthConfig } from './controllers/auth.controller';
import { getHealth } from './controllers/health.controller';
import {
  deleteProject,
  getProjectByIdParam,
  getProjectList,
  postProject,
} from './controllers/projects.controller';
import {
  deleteTask,
  getArchivedTasks,
  getTasks,
  patchTask,
  patchTaskArchive,
  patchTaskRestore,
  postTask,
} from './controllers/tasks.controller';
import { getUsers } from './controllers/users.controller';

const app = express();
const port = process.env['PORT'] ?? 3333;

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/api/health', getHealth);

/** Public Supabase URL + anon key for the Angular client (see todo supabase.client + APP_INITIALIZER). */
app.get('/api/auth', getAuthConfig);

// ---------- USERS (for task assignment picker; requires service-role Supabase key) ----------

app.get('/api/users', getUsers);

// ---------- PROJECTS ----------

app.get('/api/projects', getProjectList);
app.get('/api/projects/:id', getProjectByIdParam);
app.post('/api/projects', postProject);
app.delete('/api/projects/:id', deleteProject);

// ---------- TASKS ----------

app.get('/api/tasks', getTasks);
app.post('/api/tasks', postTask);
app.patch('/api/tasks/:id', patchTask);
app.get('/api/tasks/archived', getArchivedTasks);
app.patch('/api/tasks/:id/restore', patchTaskRestore);
app.patch('/api/tasks/:id/archive', patchTaskArchive);
app.delete('/api/tasks/:id', deleteTask);

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
