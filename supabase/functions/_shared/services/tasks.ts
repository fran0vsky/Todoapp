import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function listActiveTasksByProject(supabase: SupabaseClient, projectId: number) {
  return supabase
    .from('tasks')
    .select('id, title, description, status, assignee_email, estimate, project_id')
    .eq('archived', false)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
}

export function insertTask(supabase: SupabaseClient, insertRow: Record<string, unknown>) {
  return supabase
    .from('tasks')
    .insert(insertRow)
    .select('id, title, description, status, assignee_email, estimate, project_id')
    .single();
}

export function updateTaskById(supabase: SupabaseClient, id: number, updates: Record<string, unknown>) {
  return supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select('id, title, description, status, assignee_email, estimate, project_id')
    .single();
}

export function listArchivedTasksByProject(supabase: SupabaseClient, projectId: number) {
  return supabase
    .from('tasks')
    .select('id, title, description, status, created_at, assignee_email, estimate, project_id')
    .eq('archived', true)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
}

export function restoreTask(supabase: SupabaseClient, id: number) {
  return supabase
    .from('tasks')
    .update({ archived: false })
    .eq('id', id)
    .select('id, title, description, status, assignee_email, estimate, project_id')
    .single();
}

export function archiveTask(supabase: SupabaseClient, id: number) {
  return supabase.from('tasks').update({ archived: true }).eq('id', id).select('id').single();
}

export function deleteTaskById(supabase: SupabaseClient, id: number) {
  return supabase.from('tasks').delete().eq('id', id);
}
