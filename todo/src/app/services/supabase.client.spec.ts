import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, afterEach } from 'vitest';
import { API_BASE_URL } from '../shared/api-base';
import {
  getSupabase,
  initSupabaseFromApi,
  resetSupabaseClientForTesting,
} from './supabase.client';

describe('supabase.client', () => {
  afterEach(() => {
    resetSupabaseClientForTesting();
    TestBed.resetTestingModule();
  });

  it('getSupabase throws before init', () => {
    resetSupabaseClientForTesting();
    expect(() => getSupabase()).toThrow(/not initialized/i);
  });

  it('initSupabaseFromApi loads config and enables getSupabase', async () => {
    resetSupabaseClientForTesting();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);

    const p = initSupabaseFromApi(http);
    httpMock
      .expectOne(`${API_BASE_URL}/api/auth`)
      .flush({ url: 'https://x.supabase.co', anonKey: 'k' });
    await p;

    expect(getSupabase().supabaseUrl).toBe('https://x.supabase.co');
    httpMock.verify();
  });
});
