import { TestBed } from '@angular/core/testing'
import { Subject } from 'rxjs'
import { vi } from 'vitest'
import type { ActivityEntry } from '../../../../core/models/activity.model'
import { ActivityApiService } from '../../../../core/services/activity-api.service'
import { TaskHistory } from './task-history'

function entry(id: string, action: ActivityEntry['action']): ActivityEntry {
	return {
		action,
		changes: null,
		id,
		occurredAt: '2026-01-01T00:00:00.000Z',
		taskId: 1,
		userId: 1,
	}
}

describe('TaskHistory', () => {
	let subjects: Subject<ActivityEntry[]>[]
	let apiFake: {
		getFeed: ReturnType<typeof vi.fn>
		getTaskHistory: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		vi.resetAllMocks()
		subjects = []
		if (!HTMLDialogElement.prototype.showModal) {
			HTMLDialogElement.prototype.showModal = vi.fn()
		}
		if (!HTMLDialogElement.prototype.close) {
			HTMLDialogElement.prototype.close = vi.fn()
		}
		vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(
			function (this: HTMLDialogElement) {
				Object.defineProperty(this, 'open', { value: true })
			},
		)
		apiFake = {
			getFeed: vi.fn(),
			getTaskHistory: vi.fn(() => {
				const subject = new Subject<ActivityEntry[]>()
				subjects.push(subject)
				return subject.asObservable()
			}),
		}
		TestBed.configureTestingModule({
			imports: [TaskHistory],
			providers: [{ provide: ActivityApiService, useValue: apiFake }],
		})
	})

	async function openFor(taskId: number) {
		const fixture = TestBed.createComponent(TaskHistory)
		fixture.componentRef.setInput('open', true)
		fixture.componentRef.setInput('taskId', taskId)
		await fixture.whenStable()
		fixture.detectChanges()
		return fixture
	}

	it('resposta stale de A não sobrescreve a resposta de B em troca rápida', async () => {
		const fixture = await openFor(1)
		fixture.componentRef.setInput('taskId', 2)
		await fixture.whenStable()
		fixture.detectChanges()

		expect(apiFake.getTaskHistory).toHaveBeenCalledTimes(2)

		subjects[1].next([entry('b1', 'completed')])
		fixture.detectChanges()
		expect(fixture.nativeElement.textContent).toContain('concluída')

		subjects[0].next([entry('a1', 'created')])
		fixture.detectChanges()
		expect(fixture.nativeElement.textContent).toContain('concluída')
		expect(fixture.nativeElement.textContent).not.toContain('criada')
	})
})
