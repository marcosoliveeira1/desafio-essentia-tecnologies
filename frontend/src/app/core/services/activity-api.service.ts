import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import type { Observable } from 'rxjs'
import type { ActivityEntry } from '../models/activity.model'

@Injectable({ providedIn: 'root' })
export class ActivityApiService {
	private readonly http = inject(HttpClient)

	getTaskHistory(id: number): Observable<ActivityEntry[]> {
		return this.http.get<ActivityEntry[]>(`/api/tasks/${id}/history`)
	}

	getFeed(): Observable<ActivityEntry[]> {
		return this.http.get<ActivityEntry[]>('/api/activity')
	}
}
