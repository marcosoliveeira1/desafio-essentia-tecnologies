import { provideHttpClient } from '@angular/common/http'
import {
	HttpTestingController,
	provideHttpClientTesting,
} from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import type { CreateTaskDto, Task, UpdateTaskDto } from '../models/task.model'
import { TaskApiService } from './task-api.service'

describe('TaskApiService', () => {
	let service: TaskApiService
	let httpMock: HttpTestingController

	const task: Task = {
		completed: false,
		createdAt: '2026-01-01T00:00:00.000Z',
		description: null,
		id: 1,
		position: 1,
		title: 'Estudar Angular',
		updatedAt: '2026-01-01T00:00:00.000Z',
	}

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting(), TaskApiService],
		})
		service = TestBed.inject(TaskApiService)
		httpMock = TestBed.inject(HttpTestingController)
	})

	afterEach(() => {
		httpMock.verify()
	})

	it('list() faz GET em /api/tasks', () => {
		service.list().subscribe((tasks) => {
			expect(tasks).toEqual([task])
		})

		const req = httpMock.expectOne('/api/tasks')
		expect(req.request.method).toBe('GET')
		req.flush([task])
	})

	it('create(dto) faz POST em /api/tasks com o DTO no body', () => {
		const dto: CreateTaskDto = { description: null, title: 'Nova tarefa' }

		service.create(dto).subscribe((created) => {
			expect(created).toEqual(task)
		})

		const req = httpMock.expectOne('/api/tasks')
		expect(req.request.method).toBe('POST')
		expect(req.request.body).toEqual(dto)
		req.flush(task)
	})

	it('update(id, patch) faz PATCH em /api/tasks/:id com o patch no body', () => {
		const patch: UpdateTaskDto = { completed: true }

		service.update(1, patch).subscribe((updated) => {
			expect(updated).toEqual({ ...task, completed: true })
		})

		const req = httpMock.expectOne('/api/tasks/1')
		expect(req.request.method).toBe('PATCH')
		expect(req.request.body).toEqual(patch)
		req.flush({ ...task, completed: true })
	})

	it('update(id, { position }) faz PATCH em /api/tasks/:id com position no body', () => {
		const patch: UpdateTaskDto = { position: 6 }

		service.update(1, patch).subscribe((updated) => {
			expect(updated).toEqual({ ...task, position: 6 })
		})

		const req = httpMock.expectOne('/api/tasks/1')
		expect(req.request.method).toBe('PATCH')
		expect(req.request.body).toEqual(patch)
		req.flush({ ...task, position: 6 })
	})

	it('remove(id) faz DELETE em /api/tasks/:id', () => {
		service.remove(1).subscribe((result) => {
			expect(result).toBeNull()
		})

		const req = httpMock.expectOne('/api/tasks/1')
		expect(req.request.method).toBe('DELETE')
		req.flush(null)
	})

	it('reorder(ids) faz PATCH em /api/tasks/reorder com { ids } no body', () => {
		const ids = [2, 3, 1]

		service.reorder(ids).subscribe((tasks) => {
			expect(tasks).toEqual([task])
		})

		const req = httpMock.expectOne('/api/tasks/reorder')
		expect(req.request.method).toBe('PATCH')
		expect(req.request.body).toEqual({ ids })
		req.flush([task])
	})
})
