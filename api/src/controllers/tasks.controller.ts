import type { Request, Response } from 'express';
import type { CreateTaskBody, UpdateTaskBody } from '../types';
import { isSimpleEmail, isTaskStatus, parseEstimate } from '../services/validation';
import {
  archiveTask,
  deleteTaskById,
  insertTask,
  listActiveTasksByProject,
  listArchivedTasksByProject,
  restoreTask,
  updateTaskById,
} from '../services/tasks.service';

export async function getTasks(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.query['projectId']);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    res.status(400).json({ error: 'projectId query parameter is required' });
    return;
  }

  const { data, error } = await listActiveTasksByProject(projectId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
}

export async function postTask(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateTaskBody;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
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

  const { data, error } = await insertTask(insertRow);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
}

export async function patchTask(req: Request, res: Response): Promise<void> {
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

  const { data, error } = await updateTaskById(id, updates);
  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({
      error: error.code === 'PGRST116' ? 'task not found' : error.message,
    });
    return;
  }
  res.json(data);
}

export async function getArchivedTasks(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.query['projectId']);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    res.status(400).json({ error: 'projectId query parameter is required' });
    return;
  }

  const { data, error } = await listArchivedTasksByProject(projectId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
}

export async function patchTaskRestore(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid task id' });
    return;
  }

  const { data, error } = await restoreTask(id);
  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({
      error: error.code === 'PGRST116' ? 'task not found' : error.message,
    });
    return;
  }
  res.json(data);
}

export async function patchTaskArchive(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid task id' });
    return;
  }

  const { data, error } = await archiveTask(id);
  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({
      error: error.code === 'PGRST116' ? 'task not found' : error.message,
    });
    return;
  }
  res.json({ archived: true, id: data.id });
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid task id' });
    return;
  }

  const { error } = await deleteTaskById(id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(204).send();
}
