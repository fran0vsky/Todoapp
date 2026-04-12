import { supabase } from '../supabase';

export function listActiveTasksByProject(projectId: number) {
  return supabase
    .from('tasks')
    .select('id, title, description, status, assignee_email, estimate, project_id')
    .eq('archived', false)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
}

export function insertTask(insertRow: Record<string, unknown>) {
  return supabase
    .from('tasks')
    .insert(insertRow)
    .select('id, title, description, status, assignee_email, estimate, project_id')
    .single();
}

export function updateTaskById(id: number, updates: Record<string, unknown>) {
  return supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select('id, title, description, status, assignee_email, estimate, project_id')
    .single();
}

export function listArchivedTasksByProject(projectId: number) {
  return supabase
    .from('tasks')
    .select('id, title, description, status, created_at, assignee_email, estimate, project_id')
    .eq('archived', true)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
}

export function restoreTask(id: number) {
  return supabase
    .from('tasks')
    .update({ archived: false })
    .eq('id', id)
    .select('id, title, description, status, assignee_email, estimate, project_id')
    .single();
}

export function archiveTask(id: number) {
  return supabase.from('tasks').update({ archived: true }).eq('id', id).select('id').single();
}

export function deleteTaskById(id: number) {
  return supabase.from('tasks').delete().eq('id', id);
}
