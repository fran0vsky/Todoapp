import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Task, TaskStatus } from './task.model';

export interface AssignableUser {
  email: string;
  nickname: string | null;
}

export interface CreateTaskDto {
  project_id: number;
  title: string;
  description: string;
  status: TaskStatus;
  estimate?: number | null;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  assignee_email?: string | null;
  estimate?: number | null;
}

@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3333/api/tasks';
  private readonly usersUrl = 'http://localhost:3333/api/users';

  getAssignableUsers(): Observable<AssignableUser[]> {
    return this.http
      .get<{ users: AssignableUser[] }>(this.usersUrl)
      .pipe(map((body) => body.users ?? []));
  }

  getTasks(projectId: number): Observable<Task[]> {
    return this.http.get<Task[]>(this.baseUrl, {
      params: { projectId: String(projectId) },
    });
  }

  createTask(payload: CreateTaskDto): Observable<Task> {
    return this.http.post<Task>(this.baseUrl, payload);
  }

  updateTask(id: number, payload: UpdateTaskDto): Observable<Task> {
    return this.http.patch<Task>(`${this.baseUrl}/${id}`, payload);
  }

  getArchivedTasks(projectId: number): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/archived`, {
      params: { projectId: String(projectId) },
    });
  }

  restoreTask(id: number): Observable<Task> {
    return this.http.patch<Task>(`${this.baseUrl}/${id}/restore`, {});
  }

  archiveTask(id: number): Observable<{ archived: boolean; id: number }> {
    return this.http.patch<{ archived: boolean; id: number }>(
      `${this.baseUrl}/${id}/archive`,
      {}
    );
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

