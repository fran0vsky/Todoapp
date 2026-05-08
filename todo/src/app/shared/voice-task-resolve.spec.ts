import { describe, expect, it } from 'vitest';
import { Task, TaskStatus } from '../models/task.model';
import { resolveTaskByTitle } from './voice-task-resolve';

function t(id: number, title: string): Task {
  return {
    id,
    project_id: 1,
    title,
    description: 'd',
    status: TaskStatus.Todo,
  };
}

describe('resolveTaskByTitle', () => {
  it('returns none for empty query', () => {
    expect(resolveTaskByTitle([t(1, 'A')], '  ')).toEqual({
      ok: false,
      reason: 'none',
      candidates: [],
    });
  });

  it('resolves single includes match', () => {
    expect(resolveTaskByTitle([t(1, 'Buy milk'), t(2, 'Call')], 'mil')).toEqual(
      {
        ok: true,
        task: t(1, 'Buy milk'),
      },
    );
  });

  it('resolves when query includes whole title', () => {
    expect(resolveTaskByTitle([t(1, 'X')], 'extra x word')).toEqual({
      ok: true,
      task: t(1, 'X'),
    });
  });

  it('ambiguous on multiple includes matches', () => {
    const tasks = [t(1, 'abc def'), t(2, 'ghi abc')];
    const r = resolveTaskByTitle(tasks, 'abc');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('ambiguous');
      expect(r.candidates.length).toBe(2);
    }
  });

  it('uses fuzzy match when no includes', () => {
    const r = resolveTaskByTitle([t(1, 'hello world')], 'helo wrld');
    expect(r.ok).toBe(true);
  });

  it('returns ambiguous when fuzzy ties', () => {
    const tasks = [t(1, 'abc'), t(2, 'abd')];
    const r = resolveTaskByTitle(tasks, 'abe');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('ambiguous');
  });

  it('matches title that subsumes short query', () => {
    const tasks = [t(1, 'say hello'), t(2, 'buy')];
    const r = resolveTaskByTitle(tasks, 'hello');
    expect(r.ok).toBe(true);
  });

  it('returns none when no match', () => {
    const tasks = [t(1, 'zzzz')];
    expect(resolveTaskByTitle(tasks, 'qqqq')).toEqual({
      ok: false,
      reason: 'none',
      candidates: [],
    });
  });
});
