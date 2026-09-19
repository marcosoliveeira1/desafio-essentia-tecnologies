import { DatePipe } from '@angular/common'
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	type ElementRef,
	effect,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core'
import type {
	ActivityAction,
	ActivityEntry,
} from '../../../../core/models/activity.model'
import { ActivityApiService } from '../../../../core/services/activity-api.service'

const ACTION_LABEL: Record<ActivityAction, string> = {
	completed: 'concluída',
	created: 'criada',
	deleted: 'excluída',
	uncompleted: 'reaberta',
	updated: 'atualizada',
}

const ACTION_CLS: Record<ActivityAction, string> = {
	completed: 'bg-green-50 text-green-600',
	created: 'bg-warm text-navy',
	deleted: 'bg-red-50 text-red-500',
	uncompleted: 'bg-purple-50 text-purple-600',
	updated: 'bg-amber-50 text-amber-600',
}

@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe],
	selector: 'app-task-history',
	styleUrl: './task-history.css',
	templateUrl: './task-history.html',
})
export class TaskHistory {
	readonly taskId = input<number | null>(null)
	readonly taskTitle = input<string | null>(null)
	readonly open = input(false)
	readonly closed = output<void>()

	protected readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog')

	protected readonly entries = signal<ActivityEntry[]>([])
	protected readonly loading = signal(false)
	protected readonly errorLocal = signal<string | null>(null)

	protected readonly dialogTitle = computed(() => {
		const title = this.taskTitle()
		return title ? `Atividade — ${title.slice(0, 40)}` : 'Atividade recente'
	})

	private readonly api = inject(ActivityApiService)
	private reqSeq = 0

	constructor() {
		effect(() => {
			const native = this.dialog()?.nativeElement
			if (!native) return
			if (this.open() && !native.open) native.showModal()
			if (!this.open() && native.open) native.close()
		})

		effect(() => {
			if (!this.open()) return
			this.taskId()
			this.load()
		})
	}

	protected actionLabel(action: ActivityAction): string {
		return ACTION_LABEL[action]
	}

	protected actionCls(action: ActivityAction): string {
		return ACTION_CLS[action]
	}

	protected onClose(): void {
		this.closed.emit()
	}

	protected onRetry(): void {
		this.load()
	}

	private load(): void {
		const id = this.taskId()
		this.loading.set(true)
		this.errorLocal.set(null)
		const request =
			id === null ? this.api.getFeed() : this.api.getTaskHistory(id)
		const seq = ++this.reqSeq
		request.subscribe({
			error: () => {
				if (seq !== this.reqSeq) return
				this.errorLocal.set('Falha ao carregar atividades. Tente novamente.')
				this.loading.set(false)
			},
			next: (entries) => {
				if (seq !== this.reqSeq) return
				this.entries.set(entries)
				this.loading.set(false)
			},
		})
	}
}
