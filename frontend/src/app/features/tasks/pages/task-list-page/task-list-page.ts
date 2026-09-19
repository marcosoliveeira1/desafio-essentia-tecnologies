import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	type OnInit,
	signal,
} from '@angular/core'
import { Router } from '@angular/router'
import type { Task } from '../../../../core/models/task.model'
import { AuthStoreService } from '../../../../core/services/auth-store.service'
import { TaskStoreService } from '../../../../core/services/task-store.service'
import { EmptyState } from '../../../../shared/components/empty-state/empty-state'
import { LoadingSpinner } from '../../../../shared/components/loading-spinner/loading-spinner'
import { ConfirmDialog } from '../../components/confirm-dialog/confirm-dialog'
import { TaskFilters } from '../../components/task-filters/task-filters'
import { TaskForm } from '../../components/task-form/task-form'
import { TaskHistory } from '../../components/task-history/task-history'
import { TaskItem } from '../../components/task-item/task-item'

@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		TaskItem,
		ConfirmDialog,
		TaskForm,
		TaskFilters,
		TaskHistory,
		EmptyState,
		LoadingSpinner,
	],
	selector: 'app-task-list-page',
	styleUrl: './task-list-page.css',
	templateUrl: './task-list-page.html',
})
export class TaskListPage implements OnInit {
	protected readonly store = inject(TaskStoreService)
	protected readonly authStore = inject(AuthStoreService)
	private readonly router = inject(Router)

	protected readonly todo = computed(() =>
		this.store.filteredTasks().filter((task) => !task.completed),
	)
	protected readonly done = computed(() =>
		this.store.filteredTasks().filter((task) => task.completed),
	)

	protected readonly pendingCreate = signal<boolean | null>(null)
	protected readonly editingId = signal<number | null>(null)
	protected readonly editingTask = computed(
		() => this.store.tasks().find((t) => t.id === this.editingId()) ?? null,
	)
	protected readonly pendingDelete = signal<Task | null>(null)
	protected readonly historyTaskId = signal<number | null>(null)
	protected readonly historyFeedOpen = signal(false)
	protected readonly historyOpen = computed(
		() => this.historyFeedOpen() || this.historyTaskId() !== null,
	)
	protected readonly historyTitle = computed(
		() =>
			this.store.tasks().find((t) => t.id === this.historyTaskId())?.title ??
			null,
	)
	protected readonly dragOver = signal<'todo' | 'done' | null>(null)
	protected readonly dropHint = signal<{
		targetId: number
		before: boolean
	} | null>(null)
	protected readonly draggedId = signal<number | null>(null)

	protected readonly avatarInitial = computed(() => {
		const name = this.authStore.user()?.name?.trim() ?? ''
		return name.length > 0 ? name.charAt(0).toUpperCase() : '?'
	})

	ngOnInit(): void {
		this.store.load()
	}

	protected logout(): void {
		this.authStore.logout()
		this.store.clear()
		void this.router.navigate(['/auth/login'])
	}

	protected onSearch(event: Event): void {
		const value = (event.target as HTMLInputElement).value
		this.store.setSearch(value)
	}

	protected onRetry(): void {
		this.store.load()
	}

	protected openCreate(presetCompleted: boolean): void {
		this.pendingCreate.set(presetCompleted)
	}

	protected closeCreate(): void {
		this.pendingCreate.set(null)
	}

	protected onToggle(id: number): void {
		this.store.toggle(id)
	}

	protected onEdit(id: number): void {
		this.editingId.set(id)
	}

	protected closeEdit(): void {
		this.editingId.set(null)
	}

	protected askDelete(task: Task): void {
		this.pendingDelete.set(task)
	}

	protected cancelDelete(): void {
		this.pendingDelete.set(null)
	}

	protected confirmDelete(): void {
		const task = this.pendingDelete()
		this.pendingDelete.set(null)
		if (task) this.store.remove(task.id)
	}

	protected openHistory(id: number): void {
		this.historyFeedOpen.set(false)
		this.historyTaskId.set(id)
	}

	protected openFeed(): void {
		this.historyTaskId.set(null)
		this.historyFeedOpen.set(true)
	}

	protected closeHistory(): void {
		this.historyTaskId.set(null)
		this.historyFeedOpen.set(false)
	}

	protected onColumnDragOver(event: DragEvent, column: 'todo' | 'done'): void {
		event.preventDefault()
		this.dragOver.set(column)
	}

	protected onColumnDragLeave(): void {
		this.dragOver.set(null)
		this.dropHint.set(null)
	}

	protected onColumnDrop(event: DragEvent, toCompleted: boolean): void {
		event.preventDefault()
		this.dragOver.set(null)
		this.dropHint.set(null)
		this.draggedId.set(null)
		const raw = event.dataTransfer?.getData('text/plain')
		const id = Number(raw)
		if (!Number.isInteger(id)) return
		this.store.move(id, toCompleted)
	}

	protected onItemDragStart(id: number): void {
		this.draggedId.set(id)
	}

	protected onItemDragOver(hint: { targetId: number; before: boolean }): void {
		this.dropHint.set(hint)
	}

	protected onItemDragLeave(): void {
		this.dropHint.set(null)
	}

	protected onItemDrop(hint: { targetId: number; before: boolean }): void {
		const draggedId = this.draggedId()
		this.draggedId.set(null)
		this.dropHint.set(null)
		this.dragOver.set(null)
		if (draggedId === null || draggedId === hint.targetId) return
		const all = this.store.tasks()
		const dragged = all.find((task) => task.id === draggedId)
		const target = all.find((task) => task.id === hint.targetId)
		if (!dragged || !target) return
		if (dragged.completed !== target.completed) {
			this.store.move(draggedId, target.completed)
			return
		}
		if (this.store.sort() !== 'manual' || this.store.search().trim() !== '')
			return
		const ids = all.map((task) => task.id).filter((id) => id !== draggedId)
		const targetIndex = ids.indexOf(hint.targetId)
		if (targetIndex === -1) return
		ids.splice(hint.before ? targetIndex : targetIndex + 1, 0, draggedId)
		this.store.reorder(ids)
	}
}
