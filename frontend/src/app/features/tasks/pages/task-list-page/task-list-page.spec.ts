// biome-ignore-all lint/suspicious/noExplicitAny: spec calls protected page handlers via (comp as any) per validated plan
import { computed, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { By } from '@angular/platform-browser'
import { provideRouter } from '@angular/router'
import { vi } from 'vitest'
import type { Task } from '../../../../core/models/task.model'
import { ActivityApiService } from '../../../../core/services/activity-api.service'
import { AuthStoreService } from '../../../../core/services/auth-store.service'
import { TaskStoreService } from '../../../../core/services/task-store.service'
import { TaskListPage } from './task-list-page'

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		completed: false,
		createdAt: '2026-01-01T00:00:00.000Z',
		description: null,
		id: 1,
		position: 1,
		title: 'Estudar Angular',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	}
}

describe('TaskListPage', () => {
	const tasksSignal = signal<Task[]>([])
	const loadingSignal = signal(false)
	const pendingSignal = signal<Set<string>>(new Set())
	const errorSignal = signal<string | null>(null)
	const filterSignal = signal<'all' | 'pending' | 'done'>('all')
	const searchSignal = signal('')
	const sortSignal = signal<'manual' | 'recent' | 'old'>('manual')

	const storeFake = {
		clear: vi.fn(),
		doneCount: computed(
			() => tasksSignal().filter((task) => task.completed).length,
		),
		error: errorSignal,
		filter: filterSignal,
		filteredTasks: computed(() => tasksSignal()),
		loading: loadingSignal,
		load: vi.fn(),
		move: vi.fn(),
		pending: pendingSignal,
		pendingCount: computed(
			() => tasksSignal().filter((task) => !task.completed).length,
		),
		remove: vi.fn(),
		reorder: vi.fn(),
		search: searchSignal,
		setSearch: vi.fn(),
		sort: sortSignal,
		tasks: tasksSignal,
		toggle: vi.fn(),
		totalCount: computed(() => tasksSignal().length),
	}
	const authFake = {
		logout: vi.fn(),
		user: signal(null),
	}
	const activityFake = {
		getFeed: vi.fn(),
		getTaskHistory: vi.fn(),
	}

	beforeEach(() => {
		vi.resetAllMocks()
		tasksSignal.set([])
		loadingSignal.set(false)
		pendingSignal.set(new Set())
		errorSignal.set(null)
		filterSignal.set('all')
		searchSignal.set('')
		sortSignal.set('manual')
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
		vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
			this: HTMLDialogElement,
		) {
			Object.defineProperty(this, 'open', { value: false })
		})
		TestBed.configureTestingModule({
			imports: [TaskListPage],
			providers: [
				provideRouter([]),
				{ provide: TaskStoreService, useValue: storeFake },
				{ provide: AuthStoreService, useValue: authFake },
				{ provide: ActivityApiService, useValue: activityFake },
			],
		})
	})

	async function createPage() {
		const fixture = TestBed.createComponent(TaskListPage)
		fixture.detectChanges()
		await fixture.whenStable()
		fixture.detectChanges()
		return fixture
	}

	function seedPendingTrio(): void {
		tasksSignal.set([
			makeTask({ id: 1, title: 'T1' }),
			makeTask({ id: 2, title: 'T2' }),
			makeTask({ id: 3, title: 'T3' }),
		])
		sortSignal.set('manual')
		searchSignal.set('')
	}

	it('ngOnInit chama store.load() uma vez', async () => {
		await createPage()

		expect(storeFake.load).toHaveBeenCalledTimes(1)
	})

	it('mesma coluna: arrastar 1 antes de 3 resulta em [2,1,3]', async () => {
		const fixture = await createPage()
		seedPendingTrio()
		fixture.detectChanges()
		const comp = fixture.componentInstance

		;(comp as any).onItemDragStart(1)
		;(comp as any).onItemDrop({ before: true, targetId: 3 })

		expect(storeFake.reorder).toHaveBeenCalledTimes(1)
		expect(storeFake.reorder).toHaveBeenCalledWith([2, 1, 3])
		expect(storeFake.move).not.toHaveBeenCalled()
	})

	it('mesma coluna: arrastar 3 antes de 1 resulta em [3,1,2]', async () => {
		const fixture = await createPage()
		seedPendingTrio()
		fixture.detectChanges()
		const comp = fixture.componentInstance

		;(comp as any).onItemDragStart(3)
		;(comp as any).onItemDrop({ before: true, targetId: 1 })

		expect(storeFake.reorder).toHaveBeenCalledTimes(1)
		expect(storeFake.reorder).toHaveBeenCalledWith([3, 1, 2])
		expect(storeFake.move).not.toHaveBeenCalled()
	})

	it.each(['recent', 'old'] as const)(
		"guarda sort='%s': reorder e move NÃO chamados",
		async (sort) => {
			const fixture = await createPage()
			seedPendingTrio()
			sortSignal.set(sort)
			fixture.detectChanges()
			const comp = fixture.componentInstance

			;(comp as any).onItemDragStart(1)
			;(comp as any).onItemDrop({ before: true, targetId: 3 })

			expect(storeFake.reorder).not.toHaveBeenCalled()
			expect(storeFake.move).not.toHaveBeenCalled()
		},
	)

	it.each(['leite', '   leite  '])(
		"guarda search='%s': nenhuma chamada",
		async (search) => {
			const fixture = await createPage()
			seedPendingTrio()
			searchSignal.set(search)
			fixture.detectChanges()
			const comp = fixture.componentInstance

			;(comp as any).onItemDragStart(1)
			;(comp as any).onItemDrop({ before: true, targetId: 3 })

			expect(storeFake.reorder).not.toHaveBeenCalled()
			expect(storeFake.move).not.toHaveBeenCalled()
		},
	)

	it("search whitespace-only '   ' NÃO bloqueia o reorder", async () => {
		const fixture = await createPage()
		seedPendingTrio()
		searchSignal.set('   ')
		fixture.detectChanges()
		const comp = fixture.componentInstance

		;(comp as any).onItemDragStart(1)
		;(comp as any).onItemDrop({ before: true, targetId: 3 })

		expect(storeFake.reorder).toHaveBeenCalledTimes(1)
		expect(storeFake.reorder).toHaveBeenCalledWith([2, 1, 3])
	})

	it('openCreate(true) renderiza app-task-form com completedPreset true', async () => {
		const fixture = await createPage()
		const comp = fixture.componentInstance

		;(comp as any).openCreate(true)
		fixture.detectChanges()
		await fixture.whenStable()
		fixture.detectChanges()

		const form = fixture.debugElement.query(By.css('app-task-form'))
		expect(form).not.toBeNull()
		expect(form.componentInstance.completedPreset()).toBe(true)
	})

	it('openCreate(false) renderiza app-task-form com completedPreset false', async () => {
		const fixture = await createPage()
		const comp = fixture.componentInstance

		;(comp as any).openCreate(false)
		fixture.detectChanges()
		await fixture.whenStable()
		fixture.detectChanges()

		const form = fixture.debugElement.query(By.css('app-task-form'))
		expect(form).not.toBeNull()
		expect(form.componentInstance.completedPreset()).toBe(false)
	})

	it('onColumnDrop com payload válido chama move(2, true)', async () => {
		const fixture = await createPage()
		const comp = fixture.componentInstance
		const event = {
			dataTransfer: { getData: () => '2' },
			preventDefault: vi.fn(),
		} as unknown as DragEvent

		;(comp as any).onColumnDrop(event, true)

		expect(event.preventDefault).toHaveBeenCalled()
		expect(storeFake.move).toHaveBeenCalledTimes(1)
		expect(storeFake.move).toHaveBeenCalledWith(2, true)
	})

	it('onColumnDrop com payload não-inteiro não chama move', async () => {
		const fixture = await createPage()
		const comp = fixture.componentInstance
		const event = {
			dataTransfer: { getData: () => 'abc' },
			preventDefault: vi.fn(),
		} as unknown as DragEvent

		;(comp as any).onColumnDrop(event, true)

		expect(storeFake.move).not.toHaveBeenCalled()
	})

	it('cross-column onItemDrop com sort recent + search ativa chama move, NÃO reorder', async () => {
		const fixture = await createPage()
		tasksSignal.set([
			makeTask({ completed: false, id: 1, title: 'Pendente' }),
			makeTask({ completed: true, id: 2, title: 'Feita' }),
		])
		sortSignal.set('recent')
		searchSignal.set('leite')
		fixture.detectChanges()
		const comp = fixture.componentInstance

		;(comp as any).onItemDragStart(1)
		;(comp as any).onItemDrop({ before: true, targetId: 2 })

		expect(storeFake.move).toHaveBeenCalledTimes(1)
		expect(storeFake.move).toHaveBeenCalledWith(1, true)
		expect(storeFake.reorder).not.toHaveBeenCalled()
	})

	it('draggedId === targetId não chama nada', async () => {
		const fixture = await createPage()
		seedPendingTrio()
		fixture.detectChanges()
		const comp = fixture.componentInstance

		;(comp as any).onItemDragStart(1)
		;(comp as any).onItemDrop({ before: true, targetId: 1 })

		expect(storeFake.reorder).not.toHaveBeenCalled()
		expect(storeFake.move).not.toHaveBeenCalled()
	})

	it('ids desconhecidos não chamam nada', async () => {
		const fixture = await createPage()
		seedPendingTrio()
		fixture.detectChanges()
		const comp = fixture.componentInstance

		;(comp as any).onItemDragStart(99)
		;(comp as any).onItemDrop({ before: true, targetId: 3 })

		expect(storeFake.reorder).not.toHaveBeenCalled()
		expect(storeFake.move).not.toHaveBeenCalled()

		;(comp as any).onItemDragStart(1)
		;(comp as any).onItemDrop({ before: true, targetId: 99 })

		expect(storeFake.reorder).not.toHaveBeenCalled()
		expect(storeFake.move).not.toHaveBeenCalled()
	})
})
