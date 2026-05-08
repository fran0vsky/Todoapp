import { NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ToastService } from './services/toast.service';

@Component({
  imports: [RouterModule, NgClass],
  selector: 'app-root',
  template: `
    <router-outlet />
    @if (toastSignal(); as t) {
      <div
        role="status"
        class="pointer-events-none fixed bottom-6 left-1/2 z-[100] max-w-[min(100%,24rem)] -translate-x-1/2 px-4"
      >
        <div
          class="pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg shadow-black/40"
          [ngClass]="
            t.variant === 'success'
              ? 'border-emerald-500/35 bg-emerald-950/95 text-emerald-100'
              : 'border-red-500/35 bg-red-950/95 text-red-100'
          "
        >
          {{ t.message }}
        </div>
      </div>
    }
  `,
  host: {
    class: 'flex min-h-0 flex-1 flex-col',
  },
})
export class App {
  private readonly toastService = inject(ToastService);
  protected readonly toastSignal = this.toastService.toast;
}
