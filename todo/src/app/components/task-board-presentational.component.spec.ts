import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskBoardPresentationalComponent } from './task-board-presentational.component';
import { Task, TaskStatus } from '../models/task.model';

function makeTask(id: number, title: string, status: TaskStatus): Task {
  return {
    id,
    project_id: 1,
    title,
    description: '',
    status,
  };
}

describe('TaskBoardPresentationalComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TaskBoardPresentationalComponent],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('emits openAddWithStatus when + Add in To be done is clicked', () => {
    const fixture = TestBed.createComponent(TaskBoardPresentationalComponent);
    const cmp = fixture.componentInstance;
    const spy = vi.spyOn(cmp.openAddWithStatus, 'emit');
    cmp.tasksToBeDone = [];
    cmp.tasksWorkingOnIt = [];
    cmp.tasksDone = [];
    cmp.isLoading = false;
    fixture.detectChanges();

    const addBtn = [...fixture.nativeElement.querySelectorAll('button')].find(
      (b) => b.textContent?.includes('+ Add'),
    ) as HTMLButtonElement;
    addBtn.click();
    expect(spy).toHaveBeenCalledWith(TaskStatus.Todo);
  });

  it('emits startEdit when edit is clicked on a card', () => {
    const fixture = TestBed.createComponent(TaskBoardPresentationalComponent);
    const cmp = fixture.componentInstance;
    const task = makeTask(1, 'T1', TaskStatus.Todo);
    cmp.tasksToBeDone = [task];
    cmp.tasksWorkingOnIt = [];
    cmp.tasksDone = [];
    const spy = vi.spyOn(cmp.startEdit, 'emit');
    fixture.detectChanges();

    const editBtn = fixture.nativeElement.querySelector(
      'button[aria-label="Edit"]',
    ) as HTMLButtonElement;
    editBtn.click();
    expect(spy).toHaveBeenCalledWith(task);
  });
});
