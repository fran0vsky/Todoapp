import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { getSupabaseService } from '../_shared/client.ts';
import { getUserFromBearer, isAdmin } from '../_shared/auth.ts';
import {
  emptyResponse,
  jsonResponse,
  preflightResponse,
} from '../_shared/cors.ts';
import type { CreateProjectBody, CreateTaskBody, UpdateTaskBody } from '../_shared/types.ts';
import {
  createProject,
  deleteProjectWithTasks,
  getProjectById,
  listProjects,
} from '../_shared/services/projects.ts';
import {
  archiveTask,
  deleteTaskById,
  insertTask,
  listActiveTasksByProject,
  listArchivedTasksByProject,
  restoreTask,
  updateTaskById,
} from '../_shared/services/tasks.ts';
import { listUsersForPicker } from '../_shared/services/users.ts';
import { isSimpleEmail, isTaskStatus, parseEstimate } from '../_shared/validation.ts';
import {
  clipErrorForClient,
  handleVoiceBoard,
  handleVoiceProcess,
  isAudioMimetype,
} from '../_shared/voice.ts';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function getPathname(req: Request): string {
  let pathname = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
  // Supabase can provide either:
  // - /functions/v1/<fn>/<route>
  // - /<fn>/<route>
  // depending on runtime/proxy path rewriting.
  const fnPrefix = /^\/functions\/v1\/[^/]+/;
  pathname = pathname.replace(fnPrefix, '') || '/';
  pathname = pathname.replace(/^\/todo-api(\/|$)/, '/') || '/';
  return pathname.replace(/\/+$/, '') || '/';
}

async function readAudioFromMultipart(req: Request): Promise<{ ok: false; res: Response } | { ok: true; data: Uint8Array; mimetype: string }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return {
      ok: false,
      res: jsonResponse(req, { error: 'Invalid multipart body' }, 400),
    };
  }
  const file = form.get('audio');
  if (!file || !(file instanceof File)) {
    return {
      ok: false,
      res: jsonResponse(req, { error: 'audio file is required' }, 400),
    };
  }
  const mimetype = file.type || 'application/octet-stream';
  if (!isAudioMimetype(mimetype)) {
    return {
      ok: false,
      res: jsonResponse(req, { error: 'Only audio files are accepted' }, 400),
    };
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.byteLength > MAX_AUDIO_BYTES) {
    return {
      ok: false,
      res: jsonResponse(req, { error: 'Audio file too large' }, 413),
    };
  }
  return { ok: true, data: buf, mimetype };
}

function voiceResultToResponse(req: Request, result: Record<string, unknown>): Response {
  if ('__error' in result && typeof result['__error'] === 'number' && result['__body']) {
    return jsonResponse(req, result['__body'] as object, result['__error'] as number);
  }
  return jsonResponse(req, result);
}

async function handleGetAuth(req: Request): Promise<Response> {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    return jsonResponse(
      req,
      {
        error:
          'Server is missing SUPABASE_URL or SUPABASE_ANON_KEY — set secrets on the Edge Function.',
      },
      500
    );
  }
  return jsonResponse(req, { url, anonKey });
}

async function handleGetTasks(supabase: SupabaseClient, req: Request): Promise<Response> {
  const projectId = Number(new URL(req.url).searchParams.get('projectId'));
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return jsonResponse(req, { error: 'projectId query parameter is required' }, 400);
  }
  const { data, error } = await listActiveTasksByProject(supabase, projectId);
  if (error) {
    return jsonResponse(req, { error: error.message }, 500);
  }
  return jsonResponse(req, data);
}

async function handlePostTask(supabase: SupabaseClient, req: Request): Promise<Response> {
  let body: CreateTaskBody;
  try {
    body = (await req.json()) as CreateTaskBody;
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const status = body.status;

  let assigneeEmail: string | null = null;
  if (body.assignee_email !== undefined && body.assignee_email !== null) {
    if (typeof body.assignee_email !== 'string') {
      return jsonResponse(req, { error: 'assignee_email must be a string or null' }, 400);
    }
    const trimmed = body.assignee_email.trim();
    if (trimmed === '') {
      assigneeEmail = null;
    } else if (!isSimpleEmail(trimmed)) {
      return jsonResponse(req, { error: 'assignee_email must be a valid email' }, 400);
    } else {
      assigneeEmail = trimmed;
    }
  }

  if (!title) {
    return jsonResponse(req, { error: 'title is required' }, 400);
  }
  if (!isTaskStatus(status)) {
    return jsonResponse(req, { error: 'status must be todo, doing, or done' }, 400);
  }

  const est = parseEstimate(body.estimate);
  if (est.ok === false) {
    return jsonResponse(req, { error: est.error }, 400);
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
    return jsonResponse(req, { error: 'project_id must be a positive integer' }, 400);
  }
  insertRow['project_id'] = projectId;

  const { data, error } = await insertTask(supabase, insertRow);
  if (error) {
    return jsonResponse(req, { error: error.message }, 500);
  }
  return jsonResponse(req, data, 201);
}

async function handlePatchTask(supabase: SupabaseClient, req: Request, id: number): Promise<Response> {
  let body: UpdateTaskBody;
  try {
    body = (await req.json()) as UpdateTaskBody;
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
  }

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return jsonResponse(req, { error: 'title must be a non-empty string' }, 400);
    }
    updates['title'] = body.title.trim();
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      return jsonResponse(req, { error: 'description must be a string' }, 400);
    }
    updates['description'] = body.description.trim();
  }

  if (body.status !== undefined) {
    if (!isTaskStatus(body.status)) {
      return jsonResponse(req, { error: 'status must be todo, doing, or done' }, 400);
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
        return jsonResponse(req, { error: 'assignee_email must be a valid email' }, 400);
      } else {
        updates['assignee_email'] = trimmed;
      }
    } else {
      return jsonResponse(req, { error: 'assignee_email must be a string or null' }, 400);
    }
  }

  if (body.estimate !== undefined) {
    const est = parseEstimate(body.estimate);
    if (est.ok === false) {
      return jsonResponse(req, { error: est.error }, 400);
    }
    updates['estimate'] = est.value;
  }

  if (Object.keys(updates).length === 0) {
    return jsonResponse(req, { error: 'no fields to update' }, 400);
  }

  const { data, error } = await updateTaskById(supabase, id, updates);
  if (error) {
    return jsonResponse(
      req,
      { error: error.code === 'PGRST116' ? 'task not found' : error.message },
      error.code === 'PGRST116' ? 404 : 500
    );
  }
  return jsonResponse(req, data);
}

async function handleGetArchivedTasks(supabase: SupabaseClient, req: Request): Promise<Response> {
  const projectId = Number(new URL(req.url).searchParams.get('projectId'));
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return jsonResponse(req, { error: 'projectId query parameter is required' }, 400);
  }
  const { data, error } = await listArchivedTasksByProject(supabase, projectId);
  if (error) {
    return jsonResponse(req, { error: error.message }, 500);
  }
  return jsonResponse(req, data);
}

async function handleGetProjectList(supabase: SupabaseClient, req: Request): Promise<Response> {
  const { data, error } = await listProjects(supabase);
  if (error) {
    return jsonResponse(req, { error: error.message }, 500);
  }
  return jsonResponse(req, data);
}

async function handleGetProjectById(supabase: SupabaseClient, req: Request, id: number): Promise<Response> {
  const { data, error } = await getProjectById(supabase, id);
  if (error) {
    return jsonResponse(
      req,
      { error: error.code === 'PGRST116' ? 'project not found' : error.message },
      error.code === 'PGRST116' ? 404 : 500
    );
  }
  return jsonResponse(req, data);
}

async function handlePostProject(supabase: SupabaseClient, req: Request): Promise<Response> {
  let body: CreateProjectBody;
  try {
    body = (await req.json()) as CreateProjectBody;
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return jsonResponse(req, { error: 'name is required' }, 400);
  }
  const { data, error } = await createProject(supabase, name);
  if (error) {
    return jsonResponse(req, { error: error.message }, 500);
  }
  return jsonResponse(req, data, 201);
}

async function handleDeleteProject(supabase: SupabaseClient, req: Request, id: number): Promise<Response> {
  const user = await getUserFromBearer(supabase, req);
  if (!user) {
    return jsonResponse(req, { error: 'authorization required' }, 401);
  }
  if (!isAdmin(user)) {
    return jsonResponse(req, { error: 'only the admin can delete projects' }, 403);
  }

  const result = await deleteProjectWithTasks(supabase, id);
  if (!result.ok) {
    if (result.step === 'not_found') {
      return jsonResponse(req, { error: 'project not found' }, 404);
    }
    return jsonResponse(req, { error: result.message }, 500);
  }
  return emptyResponse(req, 204);
}

async function dispatch(req: Request, supabase: SupabaseClient): Promise<Response> {
  const pathname = getPathname(req);
  const method = req.method;

  if (method === 'OPTIONS') {
    return preflightResponse(req);
  }

  if (pathname === '/api/health' && method === 'GET') {
    return jsonResponse(req, { ok: true });
  }

  if (pathname === '/api/auth' && method === 'GET') {
    return handleGetAuth(req);
  }

  if (pathname === '/api/users' && method === 'GET') {
    const result = await listUsersForPicker(supabase);
    if (result.ok === false) {
      return jsonResponse(req, { error: result.message }, 500);
    }
    return jsonResponse(req, { users: result.users });
  }

  if (pathname === '/api/projects' && method === 'GET') {
    return handleGetProjectList(supabase, req);
  }

  const projectIdMatch = pathname.match(/^\/api\/projects\/(\d+)$/);
  if (projectIdMatch && method === 'GET') {
    const id = Number(projectIdMatch[1]);
    return handleGetProjectById(supabase, req, id);
  }

  if (pathname === '/api/projects' && method === 'POST') {
    return handlePostProject(supabase, req);
  }

  const deleteProjectMatch = pathname.match(/^\/api\/projects\/(\d+)$/);
  if (deleteProjectMatch && method === 'DELETE') {
    const id = Number(deleteProjectMatch[1]);
    return handleDeleteProject(supabase, req, id);
  }

  if (pathname === '/api/tasks' && method === 'GET') {
    return handleGetTasks(supabase, req);
  }

  if (pathname === '/api/tasks/archived' && method === 'GET') {
    return handleGetArchivedTasks(supabase, req);
  }

  if (pathname === '/api/tasks' && method === 'POST') {
    return handlePostTask(supabase, req);
  }

  const taskRestoreMatch = pathname.match(/^\/api\/tasks\/(\d+)\/restore$/);
  if (taskRestoreMatch && method === 'PATCH') {
    const id = Number(taskRestoreMatch[1]);
    if (!Number.isInteger(id) || id <= 0) {
      return jsonResponse(req, { error: 'invalid task id' }, 400);
    }
    const { data, error } = await restoreTask(supabase, id);
    if (error) {
      return jsonResponse(
        req,
        { error: error.code === 'PGRST116' ? 'task not found' : error.message },
        error.code === 'PGRST116' ? 404 : 500
      );
    }
    return jsonResponse(req, data);
  }

  const taskArchiveMatch = pathname.match(/^\/api\/tasks\/(\d+)\/archive$/);
  if (taskArchiveMatch && method === 'PATCH') {
    const id = Number(taskArchiveMatch[1]);
    if (!Number.isInteger(id) || id <= 0) {
      return jsonResponse(req, { error: 'invalid task id' }, 400);
    }
    const { data, error } = await archiveTask(supabase, id);
    if (error) {
      return jsonResponse(
        req,
        { error: error.code === 'PGRST116' ? 'task not found' : error.message },
        error.code === 'PGRST116' ? 404 : 500
      );
    }
    return jsonResponse(req, { archived: true, id: data.id });
  }

  const taskIdMatch = pathname.match(/^\/api\/tasks\/(\d+)$/);
  if (taskIdMatch && method === 'PATCH') {
    const id = Number(taskIdMatch[1]);
    if (!Number.isInteger(id) || id <= 0) {
      return jsonResponse(req, { error: 'invalid task id' }, 400);
    }
    return handlePatchTask(supabase, req, id);
  }

  if (taskIdMatch && method === 'DELETE') {
    const id = Number(taskIdMatch[1]);
    if (!Number.isInteger(id) || id <= 0) {
      return jsonResponse(req, { error: 'invalid task id' }, 400);
    }
    const { error } = await deleteTaskById(supabase, id);
    if (error) {
      return jsonResponse(req, { error: error.message }, 500);
    }
    return emptyResponse(req, 204);
  }

  if (pathname === '/api/voice/process' && method === 'POST') {
    const parsed = await readAudioFromMultipart(req);
    if (!parsed.ok) return parsed.res;
    try {
      const result = await handleVoiceProcess(parsed.data, parsed.mimetype);
      return voiceResultToResponse(req, result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Voice processing failed';
      return jsonResponse(req, { error: clipErrorForClient(message) }, 500);
    }
  }

  if (pathname === '/api/voice/board' && method === 'POST') {
    const parsed = await readAudioFromMultipart(req);
    if (!parsed.ok) return parsed.res;
    try {
      const result = await handleVoiceBoard(parsed.data, parsed.mimetype);
      return voiceResultToResponse(req, result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Voice board processing failed';
      return jsonResponse(req, { error: clipErrorForClient(message) }, 500);
    }
  }

  if (pathname === '/api/voice/log' && method === 'POST') {
    const logPath = Deno.env.get('VOICE_DATA_LOG_PATH')?.trim();
    if (!logPath) {
      return emptyResponse(req, 204);
    }
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
    }
    if (!raw || typeof raw !== 'object') {
      return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
    }
    const task = (raw as { task?: unknown }).task;
    if (typeof task !== 'string' || !task.trim()) {
      return jsonResponse(req, { error: 'task is required' }, 400);
    }
    const expectedRaw = (raw as { expected?: unknown }).expected;
    if (!expectedRaw || typeof expectedRaw !== 'object') {
      return jsonResponse(req, { error: 'expected is required' }, 400);
    }
    const exp = expectedRaw as Record<string, unknown>;
    const title = typeof exp['title'] === 'string' ? exp['title'].trim() : '';
    if (!title) {
      return jsonResponse(req, { error: 'expected.title is required' }, 400);
    }
    if (!isTaskStatus(exp['status'])) {
      return jsonResponse(req, { error: 'expected.status must be todo, doing, or done' }, 400);
    }
    void typeof exp['description'] === 'string' ? exp['description'] : '';
    const estParsed = parseEstimate(exp['estimate']);
    if (estParsed.ok === false) {
      return jsonResponse(req, { error: estParsed.error }, 400);
    }
    console.info(
      JSON.stringify({
        task: task.trim(),
        expected: {
          title,
          description: typeof exp['description'] === 'string' ? exp['description'] : '',
          status: exp['status'],
          estimate: estParsed.value,
        },
      })
    );
    return emptyResponse(req, 204);
  }

  return jsonResponse(req, { error: 'Not found' }, 404);
}

Deno.serve(async (req) => {
  try {
    const supabase = getSupabaseService();
    return await dispatch(req, supabase);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return jsonResponse(req, { error: msg }, 500);
  }
});
