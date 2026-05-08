import type { TaskStatus } from './types.ts';

const FIB_ESTIMATES = new Set<number>([1, 2, 3, 5, 8]);

export const parseEstimate = (
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

export const isSimpleEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isTaskStatus = (value: unknown): value is TaskStatus =>
  value === 'todo' || value === 'doing' || value === 'done';
