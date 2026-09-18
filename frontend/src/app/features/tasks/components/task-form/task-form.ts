import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core'
import {
	FormControl,
	FormGroup,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms'
import type { AbstractControl, ValidationErrors } from '@angular/forms'
import type { CreateTaskDto, Task } from '../../../../core/models/task.model'
import { TaskStoreService } from '../../../../core/services/task-store.service'

function noWhitespaceValidator(
	control: AbstractControl,
): ValidationErrors | null {
	const value = (control.value as string | null) ?? ''
	return value.trim().length > 0 ? null : { whitespace: true }
}

@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule],
	selector: 'app-task-form',
	styleUrl: './task-form.css',
	templateUrl: './task-form.html',
})
export class TaskForm {
	private readonly store = inject(TaskStoreService)

	// T14: `task` define modo edição; null = criação.
	readonly task = input<Task | null>(null)
	// Preset de coluna (A fazer / Concluídas). T13 NÃO envia `completed` no DTO.
	readonly completedPreset = input(false)

	readonly cancelled = output<void>()
	readonly saved = output<void>()

	protected readonly submitting = signal(false)
	protected readonly isEditing = computed(() => this.task() !== null)

	readonly form = new FormGroup({
		description: new FormControl('', {
			nonNullable: true,
			validators: [Validators.maxLength(2000)],
		}),
		title: new FormControl('', {
			nonNullable: true,
			validators: [
				Validators.required,
				Validators.maxLength(255),
				noWhitespaceValidator,
			],
		}),
	})

	protected readonly dialog =
		viewChild<ElementRef<HTMLDialogElement>>('dialog')

	constructor() {
		effect(() => {
			const current = this.task()
			if (current) {
				this.form.setValue({
					description: current.description ?? '',
					title: current.title,
				})
			} else {
				this.form.reset()
			}
			const native = this.dialog()?.nativeElement
			if (!native) return
			if (!native.open) native.showModal()
		})
	}

	protected onBackdropClick(event: MouseEvent): void {
		const native = this.dialog()?.nativeElement
		if (native && event.target === native) {
			this.onCancel()
		}
	}

	protected onCancel(): void {
		this.submitting.set(false)
		this.cancelled.emit()
	}

	protected onSubmit(): void {
		if (this.form.invalid) {
			this.form.markAllAsTouched()
			return
		}
		this.submitting.set(true)
		const rawTitle = this.form.controls.title.value
		const rawDescription = this.form.controls.description.value
		const title = rawTitle.trim()
		const description = rawDescription.trim() || null
		const current = this.task()
		if (current) {
			this.store.update(current.id, { description, title })
		} else {
			const dto: CreateTaskDto = { description, title }
			this.store.add(dto)
		}
		this.submitting.set(false)
		this.saved.emit()
	}
}
