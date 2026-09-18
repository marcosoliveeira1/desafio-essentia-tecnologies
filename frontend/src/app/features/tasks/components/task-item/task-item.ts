import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
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

	protected onDragStart(event: DragEvent): void {
		event.dataTransfer?.setData('text/plain', String(this.task().id))
	}
}
