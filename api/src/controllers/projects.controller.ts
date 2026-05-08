import type { Request, Response } from 'express';
import type { CreateProjectBody } from '../types';
import { getUserFromBearer, isAdmin } from '../services/auth.service';
import {
  createProject,
  deleteProjectWithTasks,
  getProjectById,
  listProjects,
} from '../services/projects.service';

export async function getProjectList(
  _req: Request,
  res: Response,
): Promise<void> {
  const { data, error } = await listProjects();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
}

export async function getProjectByIdParam(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number(req.params['id']);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid project id' });
    return;
  }

  const { data, error } = await getProjectById(id);
  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({
      error: error.code === 'PGRST116' ? 'project not found' : error.message,
    });
    return;
  }
  res.json(data);
}

export async function postProject(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateProjectBody;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const { data, error } = await createProject(name);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
}

export async function deleteProject(
  req: Request,
  res: Response,
): Promise<void> {
  const user = await getUserFromBearer(req);
  if (!user) {
    res.status(401).json({ error: 'authorization required' });
    return;
  }
  if (!isAdmin(user)) {
    res.status(403).json({ error: 'only the admin can delete projects' });
    return;
  }

  const id = Number(req.params['id']);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid project id' });
    return;
  }

  const result = await deleteProjectWithTasks(id);
  if (!result.ok) {
    if (result.step === 'not_found') {
      res.status(404).json({ error: 'project not found' });
      return;
    }
    res.status(500).json({ error: result.message });
    return;
  }

  res.status(204).send();
}
