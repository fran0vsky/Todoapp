import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [ToastService] });
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('show sets toast and clears after duration', () => {
    const s = TestBed.inject(ToastService);
    s.show('hi');
    expect(s.toast()?.message).toBe('hi');
    vi.advanceTimersByTime(4500);
    expect(s.toast()).toBeNull();
  });

  it('show replaces previous timer', () => {
    const s = TestBed.inject(ToastService);
    s.show('a', 'success', 1000);
    s.show('b', 'error', 1000);
    expect(s.toast()?.message).toBe('b');
    vi.advanceTimersByTime(1000);
    expect(s.toast()).toBeNull();
  });

  it('dismiss clears', () => {
    const s = TestBed.inject(ToastService);
    s.show('x');
    s.dismiss();
    expect(s.toast()).toBeNull();
  });
});
