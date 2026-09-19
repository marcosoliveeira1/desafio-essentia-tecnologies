import { computed, Injectable, inject, signal } from '@angular/core'
import type { Observable } from 'rxjs'
import { catchError, finalize, tap, throwError } from 'rxjs'
import type { CreateTaskDto, Task, UpdateTaskDto } from '../models/task.model'
import { TaskApiService } from './task-api.service'

export type TaskFilter = 'all' | 'pending' | 'done'
export type TaskSort = 'manual' | 'recent' | 'old'

const MSG_LOAD = 'Não foi possível carregar as tarefas. Tente novamente.'
const MSG_ADD = 'Não foi possível criar a tarefa. Tente novamente.'
const MSG_UPDATE = 'Não foi possível atualizar a tarefa. Tente novamente.'
const MSG_TOGGLE =
	'Não foi possível alterar o status da tarefa. Tente novamente.'
const MSG_REMOVE = 'Não foi possível excluir a tarefa. Tente novamente.'
const MSG_REORDER = 'Não foi possível reordenar as tarefas. Tente novamente.'

@Injectable({ providedIn: 'root' })
export class TaskStoreService {
	private readonly api = inject(TaskApiService)

	readonly tasks = signal<Task[]>([])
	readonly loading = signal(false)
	readonly pending = signal<Set<string>>(new Set())
	readonly error = signal<string | null>(null)
	readonly filter = signal<TaskFilter>('all')
	readonly search = signal('')
	readonly sort = signal<TaskSort>('manual')

	private loadSeq = 0

	private setPending(key: string): void {
		this.pending.update((current) => new Set(current).add(key))
	}

	private clearPending(key: string): void {
		this.pending.update((current) => {
			const next = new Set(current)
			next.delete(key)
			return next
		})
	}

	isPending(key: string): boolean {
		return this.pending().has(key)
	}

	readonly filteredTasks = computed(() => {
		const current = this.tasks()
		const status = this.filter()
		const query = this.search().trim().toLowerCase()
		const order = this.sort()

		let out = current.filter((task) => {
			if (status === 'pending') return !task.completed
			if (status === 'done') return task.completed
			return true
		})

		if (query) {
			out = out.filter(
				(task) =>
					task.title.toLowerCase().includes(query) ||
					(task.description ?? '').toLowerCase().includes(query),
			)
		}

		if (order === 'recent') {
			return [...out].sort(
				(a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
			)
		}
		if (order === 'old') {
			return [...out].sort(
				(a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
			)
		}
		return out
	})

	readonly totalCount = computed(() => this.tasks().length)
	readonly pendingCount = computed(
		() => this.tasks().filter((task) => !task.completed).length,
	)
	readonly doneCount = computed(
		() => this.tasks().filter((task) => task.completed).length,
	)

	load(): void {
		const seq = ++this.loadSeq
		this.loading.set(true)
		this.error.set(null)
		this.api.list().subscribe({
			error: () => {
				if (seq !== this.loadSeq) return
				this.error.set(MSG_LOAD)
				this.loading.set(false)
			},
			next: (tasks) => {
				if (seq !== this.loadSeq) return
				this.tasks.set(tasks)
				this.loading.set(false)
			},
		})
	}

	add(dto: CreateTaskDto): Observable<Task> {
		const key = 'create'
		this.setPending(key)
		this.error.set(null)
		return this.api.create(dto).pipe(
			tap((created) => {
				this.tasks.update((current) => [created, ...current])
			}),
			catchError((err: unknown) => {
				this.error.set(MSG_ADD)
				return throwError(() => err)
			}),
			finalize(() => {
				this.clearPending(key)
			}),
		)
	}

	update(id: number, patch: UpdateTaskDto): Observable<Task> {
		const key = `update:${id}`
		this.setPending(key)
		this.error.set(null)
		return this.api.update(id, patch).pipe(
			tap((updated) => {
				this.tasks.update((current) =>
					current.map((task) => (task.id === id ? updated : task)),
				)
			}),
			catchError((err: unknown) => {
				this.error.set(MSG_UPDATE)
				return throwError(() => err)
			}),
			finalize(() => {
				this.clearPending(key)
			}),
		)
	}

	toggle(id: number): void {
		const current = this.tasks().find((task) => task.id === id)
		if (!current) return
		// move()/drag reuses the same `toggle:<id>` key — single per-item indicator.
		const key = `toggle:${id}`
		const snapshot = current
		this.error.set(null)
		this.setPending(key)
		this.tasks.update((all) =>
			all.map((task) =>
				task.id === id ? { ...task, completed: !task.completed } : task,
			),
		)
		this.api.update(id, { completed: !snapshot.completed }).subscribe({
			error: () => {
				this.tasks.update((all) =>
					all.map((task) => (task.id === id ? snapshot : task)),
				)
				this.error.set(MSG_TOGGLE)
				this.clearPending(key)
			},
			next: (updated) => {
				this.tasks.update((all) =>
					all.map((task) => (task.id === id ? updated : task)),
				)
				this.clearPending(key)
			},
		})
	}

	remove(id: number): void {
		const key = `delete:${id}`
		this.setPending(key)
		this.error.set(null)
		this.api.remove(id).subscribe({
			error: () => {
				this.error.set(MSG_REMOVE)
				this.clearPending(key)
			},
			next: () => {
				this.tasks.update((current) => current.filter((task) => task.id !== id))
				this.clearPending(key)
			},
		})
	}

	/**
	 * Move de drag-and-drop entre as colunas do kanban (toggle-only).
	 *
	 * - Coluna diferente (`completed` diverge): persiste via
	 *   `PATCH /api/tasks/:id` com `{ completed }` e substitui o item local
	 *   pelo retorno da API (erro usa MSG_TOGGLE).
	 * - Mesma coluna (drop intra-coluna): no-op — reorder fino por índice
	 *   é feito via `reorder(ids)`, não via `move`.
	 */
	move(id: number, toCompleted: boolean): void {
		const current = this.tasks().find((task) => task.id === id)
		if (!current) return
		if (current.completed === toCompleted) return
		// Reuses the `toggle:<id>` key shared with toggle() — one per-item indicator.
		const key = `toggle:${id}`
		const snapshot = current
		this.error.set(null)
		this.setPending(key)
		this.tasks.update((all) =>
			all.map((task) =>
				task.id === id ? { ...task, completed: toCompleted } : task,
			),
		)
		this.api.update(id, { completed: toCompleted }).subscribe({
			error: () => {
				this.tasks.update((all) =>
					all.map((task) => (task.id === id ? snapshot : task)),
				)
				this.error.set(MSG_TOGGLE)
				this.clearPending(key)
			},
			next: (updated) => {
				this.tasks.update((all) =>
					all.map((task) => (task.id === id ? updated : task)),
				)
				this.clearPending(key)
			},
		})
	}

	/**
	 * Reorder fino por ids globais completos.
	 *
	 * Persiste via `PATCH /api/tasks/reorder` com `{ ids }` e substitui
	 * a lista local pelo retorno da API. Guard: lista vazia é no-op.
	 */
	reorder(ids: number[]): void {
		if (ids.length === 0) return
		const key = 'reorder'
		this.setPending(key)
		this.error.set(null)
		this.api.reorder(ids).subscribe({
			error: () => {
				this.error.set(MSG_REORDER)
				this.clearPending(key)
			},
			next: (tasks) => {
				this.tasks.set(tasks)
				this.clearPending(key)
			},
		})
	}

	setFilter(filter: TaskFilter): void {
		this.filter.set(filter)
	}

	setSearch(search: string): void {
		this.search.set(search)
	}

	setSort(sort: TaskSort): void {
		this.sort.set(sort)
	}

	clearError(): void {
		this.error.set(null)
	}

	clear(): void {
		this.tasks.set([])
		this.error.set(null)
		this.pending.set(new Set())
	}
}
