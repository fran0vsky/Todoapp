import { Task } from '../models/task.model';

export type ResolveTaskByTitleResult =
  | { ok: true; task: Task }
  | { ok: false; reason: 'none' | 'ambiguous'; candidates: Task[] };

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prevRow = new Uint32Array(n + 1);
  const curRow = new Uint32Array(n + 1);
  for (let j = 0; j <= n; j++) prevRow[j] = j;
  for (let i = 1; i <= m; i++) {
    curRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curRow[j] = Math.min(
        curRow[j - 1] + 1,
        prevRow[j] + 1,
        prevRow[j - 1] + cost,
      );
    }
    for (let j = 0; j <= n; j++) prevRow[j] = curRow[j];
  }
  return prevRow[n];
}

/**
 * Match a spoken task fragment to a single board task, or report none / ambiguous.
 */
export function resolveTaskByTitle(
  tasks: Task[],
  query: string,
): ResolveTaskByTitleResult {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { ok: false, reason: 'none', candidates: [] };
  }

  const includesMatches = tasks.filter((t) => {
    const title = t.title.trim().toLowerCase();
    return title.includes(q) || q.includes(title);
  });

  if (includesMatches.length === 1) {
    return { ok: true, task: includesMatches[0] };
  }
  if (includesMatches.length > 1) {
    return { ok: false, reason: 'ambiguous', candidates: includesMatches };
  }

  let best: Task | null = null;
  let bestDist = Infinity;
  for (const t of tasks) {
    const title = t.title.trim().toLowerCase();
    if (!title) continue;
    const d = levenshtein(q, title);
    const threshold = Math.max(
      2,
      Math.floor(Math.min(q.length, title.length) / 3) + 1,
    );
    if (d < bestDist && d <= threshold) {
      bestDist = d;
      best = t;
    }
  }

  if (best) {
    const ties = tasks.filter((t) => {
      const title = t.title.trim().toLowerCase();
      if (!title) return false;
      const d = levenshtein(q, title);
      return d === bestDist;
    });
    if (ties.length === 1) {
      return { ok: true, task: ties[0] };
    }
    return { ok: false, reason: 'ambiguous', candidates: ties };
  }

  return { ok: false, reason: 'none', candidates: [] };
}
