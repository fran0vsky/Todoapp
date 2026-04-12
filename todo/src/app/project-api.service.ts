import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Project } from './project.model';
import { API_BASE_URL } from './api-base';
import { getSupabase } from './supabase.client';

export interface CreateProjectDto {
  name: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/api/projects`;

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.baseUrl);
  }

  getProject(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl}/${id}`);
  }

  createProject(payload: CreateProjectDto): Observable<Project> {
    return this.http.post<Project>(this.baseUrl, payload);
  }

  deleteProject(id: number): Observable<void> {
    return from(getSupabase().auth.getSession()).pipe(
      switchMap(({ data: { session } }) => {
        if (!session?.access_token) {
          return throwError(() => new Error('Not signed in'));
        }
        return this.http.delete<void>(`${this.baseUrl}/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      })
    );
  }
}
