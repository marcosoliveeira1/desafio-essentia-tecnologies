import { provideHttpClient } from '@angular/common/http'
import {
	HttpTestingController,
	provideHttpClientTesting,
} from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import type { ActivityEntry } from '../models/activity.model'
import { ActivityApiService } from './activity-api.service'

describe('ActivityApiService', () => {
	let service: ActivityApiService
	let httpMock: HttpTestingController

	const entry: ActivityEntry = {
		action: 'created',
		changes: null,
		id: 'abc123',
		occurredAt: '2026-01-01T00:00:00.000Z',
		taskId: 1,
		userId: 7,
	}

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting(), ActivityApiService],
		})
		service = TestBed.inject(ActivityApiService)
		httpMock = TestBed.inject(HttpTestingController)
	})

	afterEach(() => {
		httpMock.verify()
	})

	it('getTaskHistory(id) faz GET em /api/tasks/:id/history', () => {
		service.getTaskHistory(1).subscribe((entries) => {
			expect(entries).toEqual([entry])
		})

		const req = httpMock.expectOne('/api/tasks/1/history')
		expect(req.request.method).toBe('GET')
		req.flush([entry])
	})

	it('getFeed() faz GET em /api/activity', () => {
		service.getFeed().subscribe((entries) => {
			expect(entries).toEqual([entry])
		})

		const req = httpMock.expectOne('/api/activity')
		expect(req.request.method).toBe('GET')
		req.flush([entry])
	})
})
