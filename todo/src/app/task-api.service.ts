import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Task, TaskStatus } from './task.model';

export interface CreateTaskDto {
  title: string;
  description: string;
  status: TaskStatus;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
}

@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3333/api/tasks';

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.baseUrl);
  }

  createTask(payload: CreateTaskDto): Observable<Task> {
    return this.http.post<Task>(this.baseUrl, payload);
  }

  updateTask(id: number, payload: UpdateTaskDto): Observable<Task> {
    return this.http.patch<Task>(`${this.baseUrl}/${id}`, payload);
  }

  getArchivedTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/archived`);
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

