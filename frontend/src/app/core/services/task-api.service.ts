import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import type { Observable } from 'rxjs'
import type { CreateTaskDto, Task, UpdateTaskDto } from '../models/task.model'

@Injectable({ providedIn: 'root' })
export class TaskApiService {
	private readonly http = inject(HttpClient)
	private readonly base = '/api/tasks'

	list(): Observable<Task[]> {
		return this.http.get<Task[]>(this.base)
	}

	create(dto: CreateTaskDto): Observable<Task> {
		return this.http.post<Task>(this.base, dto)
	}

	update(id: number, patch: UpdateTaskDto): Observable<Task> {
		return this.http.patch<Task>(`${this.base}/${id}`, patch)
	}

	remove(id: number): Observable<void> {
		return this.http.delete<void>(`${this.base}/${id}`)
	}

	reorder(ids: number[]): Observable<Task[]> {
		return this.http.patch<Task[]>(`${this.base}/reorder`, { ids })
	}
}
