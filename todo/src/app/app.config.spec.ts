import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, afterEach } from 'vitest';
import { appConfig } from './app.config';
import {
  resetSupabaseClientForTesting,
  getSupabase,
} from './services/supabase.client';
import { API_BASE_URL } from './shared/api-base';

describe('appConfig', () => {
  afterEach(() => {
    resetSupabaseClientForTesting();
    TestBed.resetTestingModule();
  });

  it('runs initializer to load Supabase from /api/auth', async () => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    const httpMock = TestBed.inject(HttpTestingController);
    const init = TestBed.inject(ApplicationInitStatus);
    const done = init.donePromise;
    httpMock
      .expectOne(`${API_BASE_URL}/api/auth`)
      .flush({ url: 'https://test.supabase.co', anonKey: 'k' });
    await done;
    expect(getSupabase().supabaseUrl).toBe('https://test.supabase.co');
    httpMock.verify();
  });
});
