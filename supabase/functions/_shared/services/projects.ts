import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function listProjects(supabase: SupabaseClient) {
  return supabase.from('projects').select('id, name, created_at').order('created_at', { ascending: false });
}

export function getProjectById(supabase: SupabaseClient, id: number) {
  return supabase.from('projects').select('id, name, created_at').eq('id', id).single();
}

export function createProject(supabase: SupabaseClient, name: string) {
  return supabase.from('projects').insert({ name }).select('id, name, created_at').single();
}

export async function deleteProjectWithTasks(supabase: SupabaseClient, id: number) {
  const { data: project, error: fetchErr } = await supabase
    .from('projects')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false as const, step: 'fetch' as const, message: fetchErr.message };
  }
  if (!project) {
    return { ok: false as const, step: 'not_found' as const };
  }

  const { error: taskErr } = await supabase.from('tasks').delete().eq('project_id', id);
  if (taskErr) {
    return { ok: false as const, step: 'tasks' as const, message: taskErr.message };
  }

  const { error: projErr } = await supabase.from('projects').delete().eq('id', id);
  if (projErr) {
    return { ok: false as const, step: 'project' as const, message: projErr.message };
  }

  return { ok: true as const };
}
