import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
} from '@angular/core'
import type {
	TaskFilter,
	TaskSort,
} from '../../../../core/services/task-store.service'
import { TaskStoreService } from '../../../../core/services/task-store.service'

@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	selector: 'app-task-filters',
	styleUrl: './task-filters.css',
	templateUrl: './task-filters.html',
})
export class TaskFilters {
	protected readonly store = inject(TaskStoreService)

	protected readonly sortOpen = signal(false)
	protected readonly sortLabel = computed(() => {
		switch (this.store.sort()) {
			case 'recent':
				return 'Mais recentes'
			case 'old':
				return 'Mais antigas'
			default:
				return 'Manual'
		}
	})

	protected setFilter(filter: TaskFilter): void {
		this.store.setFilter(filter)
	}

	protected setSort(sort: TaskSort): void {
		this.store.setSort(sort)
		this.sortOpen.set(false)
	}

	protected toggleSort(): void {
		this.sortOpen.update((open) => !open)
	}
}
