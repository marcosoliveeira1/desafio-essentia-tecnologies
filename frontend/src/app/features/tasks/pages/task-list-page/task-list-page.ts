import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	OnInit,
	signal,
} from '@angular/core'
import type { Task } from '../../../../core/models/task.model'
import { TaskStoreService } from '../../../../core/services/task-store.service'
import { ConfirmDialog } from '../../components/confirm-dialog/confirm-dialog'
import { TaskItem } from '../../components/task-item/task-item'

@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TaskItem, ConfirmDialog],
	selector: 'app-task-list-page',
	styleUrl: './task-list-page.css',
	templateUrl: './task-list-page.html',
})
export class TaskListPage implements OnInit {
	protected readonly store = inject(TaskStoreService)

	protected readonly todo = computed(() =>
		this.store.filteredTasks().filter((task) => !task.completed),
	)
	protected readonly done = computed(() =>
		this.store.filteredTasks().filter((task) => task.completed),
	)

	protected readonly pendingCreate = signal<boolean | null>(null)
	protected readonly editingId = signal<number | null>(null)
	protected readonly pendingDelete = signal<Task | null>(null)
	protected readonly dragOver = signal<'todo' | 'done' | null>(null)

	ngOnInit(): void {
		this.store.load()
	}

	protected onSearch(event: Event): void {
		const value = (event.target as HTMLInputElement).value
		this.store.setSearch(value)
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

	protected onColumnDragOver(event: DragEvent, column: 'todo' | 'done'): void {
		event.preventDefault()
		this.dragOver.set(column)
	}

	protected onColumnDragLeave(): void {
		this.dragOver.set(null)
	}

	protected onColumnDrop(event: DragEvent, toCompleted: boolean): void {
		event.preventDefault()
		this.dragOver.set(null)
		const raw = event.dataTransfer?.getData('text/plain')
		const id = Number(raw)
		if (!Number.isInteger(id)) return
		this.store.move(id, toCompleted)
	}
}
