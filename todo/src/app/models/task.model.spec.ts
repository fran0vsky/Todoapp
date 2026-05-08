import { describe, expect, it } from 'vitest';
import { FIBONACCI_ESTIMATES, TaskStatus } from '../models/task.model';

describe('task model exports', () => {
  it('TaskStatus has expected values', () => {
    expect(TaskStatus.Todo).toBe('todo');
    expect(TaskStatus.Doing).toBe('doing');
    expect(TaskStatus.Done).toBe('done');
  });

  it('FIBONACCI_ESTIMATES are ordered', () => {
    expect(FIBONACCI_ESTIMATES).toEqual([1, 2, 3, 5, 8]);
  });
});
