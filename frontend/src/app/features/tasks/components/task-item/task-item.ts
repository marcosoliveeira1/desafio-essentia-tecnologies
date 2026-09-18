import { DatePipe } from '@angular/common'
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	linkedSignal,
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
	readonly history = output<void>()
	readonly dragOverItem = output<{ targetId: number; before: boolean }>()
	readonly dropOnItem = output<{ targetId: number; before: boolean }>()

	protected readonly dragEnabled = signal(false)

	// Colapso de textos longos: começa colapsado, reseta ao trocar de tarefa.
	protected readonly expanded = linkedSignal(() => {
		this.task().id
		return false
	})
	private static readonly DESCRIPTION_PREVIEW_LIMIT = 180
	private static readonly TITLE_CLAMP_LIMIT = 120

	protected readonly isLongDescription = computed(
		() =>
			(this.task().description?.length ?? 0) >
			TaskItem.DESCRIPTION_PREVIEW_LIMIT,
	)
	protected readonly isLongTitle = computed(
		() => this.task().title.length > TaskItem.TITLE_CLAMP_LIMIT,
	)
	protected readonly showToggle = computed(
		() => this.isLongDescription() || this.isLongTitle(),
	)
	protected readonly displayedDescription = computed(() => {
		const description = this.task().description ?? ''
		if (this.expanded() || !this.isLongDescription()) return description
		return `${description.slice(0, TaskItem.DESCRIPTION_PREVIEW_LIMIT)}…`
	})

	protected toggleExpanded(): void {
		this.expanded.update((v) => !v)
	}

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
