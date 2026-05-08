import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, expect, it, afterEach } from 'vitest';
import { API_BASE_URL } from '../shared/api-base';
import { TaskStatus } from '../models/task.model';
import { TaskApiService } from './task-api.service';

describe('TaskApiService', () => {
  let httpMock: HttpTestingController;
  let service: TaskApiService;

  afterEach(() => {
    httpMock.verify();
  });

  it('getAssignableUsers maps body', () => {
    TestBed.configureTestingModule({
      providers: [
        TaskApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TaskApiService);
    httpMock = TestBed.inject(HttpTestingController);

    service
      .getAssignableUsers()
      .subscribe((u) => expect(u).toEqual([{ email: 'e', nickname: null }]));
    const r = httpMock.expectOne(`${API_BASE_URL}/api/users`);
    r.flush({ users: [{ email: 'e', nickname: null }] });
  });

  it('getAssignableUsers handles missing users key', () => {
    TestBed.configureTestingModule({
      providers: [
        TaskApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TaskApiService);
    httpMock = TestBed.inject(HttpTestingController);
    service.getAssignableUsers().subscribe((u) => expect(u).toEqual([]));
    httpMock.expectOne(`${API_BASE_URL}/api/users`).flush({});
  });

  it('getTasks uses projectId param', () => {
    TestBed.configureTestingModule({
      providers: [
        TaskApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TaskApiService);
    httpMock = TestBed.inject(HttpTestingController);
    service.getTasks(9).subscribe((t) => expect(t.length).toBe(0));
    const r = httpMock.expectOne((req) =>
      req.urlWithParams.includes('projectId=9'),
    );
    r.flush([]);
  });

  it('createTask posts body', () => {
    TestBed.configureTestingModule({
      providers: [
        TaskApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TaskApiService);
    httpMock = TestBed.inject(HttpTestingController);
    const dto = {
      project_id: 1,
      title: 't',
      description: 'd',
      status: TaskStatus.Todo,
      estimate: null,
    };
    service.createTask(dto).subscribe((t) => expect(t.id).toBe(3));
    const r = httpMock.expectOne(`${API_BASE_URL}/api/tasks`);
    expect(r.request.method).toBe('POST');
    r.flush({ ...dto, id: 3 });
  });

  it('updateTask patches', () => {
    TestBed.configureTestingModule({
      providers: [
        TaskApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TaskApiService);
    httpMock = TestBed.inject(HttpTestingController);
    service.updateTask(1, { title: 'x' }).subscribe(() => undefined);
    const r = httpMock.expectOne(`${API_BASE_URL}/api/tasks/1`);
    expect(r.request.method).toBe('PATCH');
    r.flush({});
  });

  it('getArchivedTasks', () => {
    TestBed.configureTestingModule({
      providers: [
        TaskApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TaskApiService);
    httpMock = TestBed.inject(HttpTestingController);
    service.getArchivedTasks(2).subscribe((a) => expect(a).toEqual([]));
    httpMock.expectOne((req) => req.url.includes('/archived')).flush([]);
  });

  it('restoreTask', () => {
    TestBed.configureTestingModule({
      providers: [
        TaskApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TaskApiService);
    httpMock = TestBed.inject(HttpTestingController);
    service.restoreTask(4).subscribe(() => undefined);
    const r = httpMock.expectOne(`${API_BASE_URL}/api/tasks/4/restore`);
    expect(r.request.method).toBe('PATCH');
    r.flush({});
  });

  it('archiveTask', () => {
    TestBed.configureTestingModule({
      providers: [
        TaskApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TaskApiService);
    httpMock = TestBed.inject(HttpTestingController);
    service.archiveTask(5).subscribe((x) => expect(x.archived).toBe(true));
    const r = httpMock.expectOne(`${API_BASE_URL}/api/tasks/5/archive`);
    r.flush({ archived: true, id: 5 });
  });

  it('deleteTask', () => {
    TestBed.configureTestingModule({
      providers: [
        TaskApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TaskApiService);
    httpMock = TestBed.inject(HttpTestingController);
    service.deleteTask(6).subscribe(() => undefined);
    const r = httpMock.expectOne(`${API_BASE_URL}/api/tasks/6`);
    expect(r.request.method).toBe('DELETE');
    r.flush(null);
  });
});
