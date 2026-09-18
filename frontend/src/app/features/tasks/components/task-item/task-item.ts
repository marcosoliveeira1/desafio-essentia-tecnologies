import { DatePipe } from '@angular/common'
import {
	ChangeDetectionStrategy,
	Component,
	input,
	output,
	signal,
} from '@angular/core'
import type { Task } from '../../../../core/models/task.model'

@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe],
	selector: 'app-task-item',
	styleUrl: './task-item.css',
	templateUrl: './task-item.html',
})
export class TaskItem {
	readonly task = input.required<Task>()
	readonly toggle = output<void>()
	readonly edit = output<void>()
	readonly delete = output<void>()
	readonly dragOverItem = output<{ targetId: number; before: boolean }>()
	readonly dropOnItem = output<{ targetId: number; before: boolean }>()

	protected readonly dragEnabled = signal(false)

	protected enableDrag(): void {
		this.dragEnabled.set(true)
	}

	protected disableDrag(): void {
		this.dragEnabled.set(false)
	}

	protected onDragStart(event: DragEvent): void {
		event.dataTransfer?.setData('text/plain', String(this.task().id))
	}

	protected onItemDragOver(event: DragEvent): void {
		event.preventDefault()
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
		const before = event.clientY < rect.top + rect.height / 2
		this.dragOverItem.emit({ before, targetId: this.task().id })
	}

	protected onItemDrop(event: DragEvent): void {
		event.preventDefault()
		event.stopPropagation()
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
		const before = event.clientY < rect.top + rect.height / 2
		this.dropOnItem.emit({ before, targetId: this.task().id })
	}

	protected onDragEnd(): void {
		this.disableDrag()
	}
}
