import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RouterModule } from '@angular/router';
import { ToastService } from './services/toast.service';
import { App } from './app';

describe('App', () => {
  it('shows toast banner when toast service emits', async () => {
    TestBed.configureTestingModule({
      imports: [App, RouterModule.forRoot([])],
    });
    const toast = TestBed.inject(ToastService);
    toast.show('saved');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('saved');
    toast.dismiss();
    fixture.detectChanges();
  });
});
