import {
	ChangeDetectionStrategy,
	Component,
	input,
	output,
} from '@angular/core'
import type { Task } from '../../../../core/models/task.model'
import { TaskItem } from '../task-item/task-item'

@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TaskItem],
	selector: 'app-kanban-column',
	styleUrl: './kanban-column.css',
	templateUrl: './kanban-column.html',
})
export class KanbanColumn {
	readonly title = input.required<string>()
	readonly tasks = input.required<Task[]>()
	readonly completed = input.required<boolean>()
	readonly emptyText = input.required<string>()
	readonly dragActive = input(false)
	readonly dropHint = input<{ targetId: number; before: boolean } | null>(null)

	readonly columnDragOver = output<DragEvent>()
	readonly columnDragLeave = output<void>()
	readonly columnDrop = output<DragEvent>()
	readonly add = output<void>()
	readonly taskToggle = output<number>()
	readonly taskEdit = output<number>()
	readonly taskRemove = output<Task>()
	readonly taskHistory = output<number>()
	readonly taskDragStart = output<number>()
	readonly taskDragOver = output<{ targetId: number; before: boolean }>()
	readonly taskDragLeave = output<void>()
	readonly taskDrop = output<{ targetId: number; before: boolean }>()
}
