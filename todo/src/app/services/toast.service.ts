import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error';

export interface ToastPayload {
  message: string;
  variant: ToastVariant;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastSig = signal<ToastPayload | null>(null);
  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  readonly toast = this.toastSig.asReadonly();

  show(
    message: string,
    variant: ToastVariant = 'success',
    durationMs = 4500,
  ): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
    this.toastSig.set({ message, variant });
    this.clearTimer = setTimeout(() => {
      this.toastSig.set(null);
      this.clearTimer = null;
    }, durationMs);
  }

  dismiss(): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
    this.toastSig.set(null);
  }
}
