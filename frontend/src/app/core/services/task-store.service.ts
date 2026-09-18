import { computed, inject, Injectable, signal } from '@angular/core'
import type {
	CreateTaskDto,
	Task,
	UpdateTaskDto,
} from '../models/task.model'
import { TaskApiService } from './task-api.service'

export type TaskFilter = 'all' | 'pending' | 'done'
export type TaskSort = 'manual' | 'recent' | 'old'

const MSG_LOAD = 'Não foi possível carregar as tarefas. Tente novamente.'
const MSG_ADD = 'Não foi possível criar a tarefa. Tente novamente.'
const MSG_UPDATE = 'Não foi possível atualizar a tarefa. Tente novamente.'
const MSG_TOGGLE = 'Não foi possível alterar o status da tarefa. Tente novamente.'
const MSG_REMOVE = 'Não foi possível excluir a tarefa. Tente novamente.'

@Injectable({ providedIn: 'root' })
export class TaskStoreService {
	private readonly api = inject(TaskApiService)

	readonly tasks = signal<Task[]>([])
	readonly loading = signal(false)
	readonly error = signal<string | null>(null)
	readonly filter = signal<TaskFilter>('all')
	readonly search = signal('')
	readonly sort = signal<TaskSort>('manual')

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
		this.loading.set(true)
		this.error.set(null)
		this.api.list().subscribe({
			error: () => {
				this.error.set(MSG_LOAD)
				this.loading.set(false)
			},
			next: (tasks) => {
				this.tasks.set(tasks)
				this.loading.set(false)
			},
		})
	}

	add(dto: CreateTaskDto): void {
		this.loading.set(true)
		this.error.set(null)
		this.api.create(dto).subscribe({
			error: () => {
				this.error.set(MSG_ADD)
				this.loading.set(false)
			},
			next: (created) => {
				this.tasks.update((current) => [created, ...current])
				this.loading.set(false)
			},
		})
	}

	update(id: number, patch: UpdateTaskDto): void {
		this.loading.set(true)
		this.error.set(null)
		this.api.update(id, patch).subscribe({
			error: () => {
				this.error.set(MSG_UPDATE)
				this.loading.set(false)
			},
			next: (updated) => {
				this.tasks.update((current) =>
					current.map((task) => (task.id === id ? updated : task)),
				)
				this.loading.set(false)
			},
		})
	}

	toggle(id: number): void {
		const current = this.tasks().find((task) => task.id === id)
		if (!current) return
		this.loading.set(true)
		this.error.set(null)
		this.api.update(id, { completed: !current.completed }).subscribe({
			error: () => {
				this.error.set(MSG_TOGGLE)
				this.loading.set(false)
			},
			next: (updated) => {
				this.tasks.update((all) =>
					all.map((task) => (task.id === id ? updated : task)),
				)
				this.loading.set(false)
			},
		})
	}

	remove(id: number): void {
		this.loading.set(true)
		this.error.set(null)
		this.api.remove(id).subscribe({
			error: () => {
				this.error.set(MSG_REMOVE)
				this.loading.set(false)
			},
			next: () => {
				this.tasks.update((current) =>
					current.filter((task) => task.id !== id),
				)
				this.loading.set(false)
			},
		})
	}

	/**
	 * Move de drag-and-drop entre as colunas do kanban.
	 *
	 * - Coluna diferente (`completed` diverge): persiste via
	 *   `PATCH /api/tasks/:id` com `{ completed }` e substitui o item local
	 *   pelo retorno da API. Nunca envia `position` (o backend responde 400).
	 * - Mesma coluna: apenas reorder local (remove e reinsere o item no fim
	 *   da sua coluna), sem chamada HTTP — **não persiste após reload**,
	 *   pois o backend não expõe `position`.
	 */
	move(id: number, toCompleted: boolean): void {
		const current = this.tasks().find((task) => task.id === id)
		if (!current) return
		if (current.completed !== toCompleted) {
			this.loading.set(true)
			this.error.set(null)
			this.api.update(id, { completed: toCompleted }).subscribe({
				error: () => {
					this.error.set(MSG_TOGGLE)
					this.loading.set(false)
				},
				next: (updated) => {
					this.tasks.update((all) =>
						all.map((task) => (task.id === id ? updated : task)),
					)
					this.loading.set(false)
				},
			})
			return
		}
		this.tasks.update((all) => {
			const item = all.find((task) => task.id === id)
			if (!item) return all
			return [...all.filter((task) => task.id !== id), item]
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
}
