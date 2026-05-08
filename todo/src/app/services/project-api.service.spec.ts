import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { API_BASE_URL } from '../shared/api-base';
import { ProjectApiService } from './project-api.service';

const sessionHolder = vi.hoisted(() => ({
  accessToken: null as string | null,
}));

vi.mock('./supabase.client', () => ({
  getSupabase: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({
          data: {
            session: sessionHolder.accessToken
              ? {
                  access_token: sessionHolder.accessToken,
                  user: {
                    id: 'u',
                    aud: '',
                    role: '',
                    email: '',
                    email_confirmed_at: '',
                    phone: '',
                    confirmed_at: '',
                    last_sign_in_at: '',
                    app_metadata: {},
                    user_metadata: {},
                    identities: [],
                    created_at: '',
                    updated_at: '',
                  },
                  expires_in: 3600,
                  expires_at: Math.floor(Date.now() / 1000) + 3600,
                  refresh_token: 'r',
                  token_type: 'bearer',
                }
              : null,
          },
        }),
    },
  }),
}));

describe('ProjectApiService', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionHolder.accessToken = null;
    TestBed.configureTestingModule({
      providers: [
        ProjectApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('getProjects', () => {
    const service = TestBed.inject(ProjectApiService);
    service.getProjects().subscribe((p) => expect(p.length).toBe(0));
    httpMock.expectOne(`${API_BASE_URL}/api/projects`).flush([]);
  });

  it('getProject', () => {
    const service = TestBed.inject(ProjectApiService);
    service.getProject(1).subscribe((p) => expect(p.name).toBe('X'));
    httpMock
      .expectOne(`${API_BASE_URL}/api/projects/1`)
      .flush({ id: 1, name: 'X' });
  });

  it('createProject', () => {
    const service = TestBed.inject(ProjectApiService);
    service.createProject({ name: 'N' }).subscribe(() => undefined);
    const r = httpMock.expectOne(`${API_BASE_URL}/api/projects`);
    expect(r.request.method).toBe('POST');
    r.flush({ id: 2, name: 'N' });
  });

  it('deleteProject errors when no session', async () => {
    const service = TestBed.inject(ProjectApiService);
    sessionHolder.accessToken = null;
    await expect(firstValueFrom(service.deleteProject(1))).rejects.toThrow(
      /Not signed in/,
    );
  });

  it('deleteProject sends bearer when session exists', async () => {
    const service = TestBed.inject(ProjectApiService);
    sessionHolder.accessToken = 'tok';
    const promise = firstValueFrom(service.deleteProject(3));
    await Promise.resolve();
    const r = httpMock.expectOne(`${API_BASE_URL}/api/projects/3`);
    expect(r.request.headers.get('Authorization')).toBe('Bearer tok');
    r.flush(null);
    await promise;
  });
});
