import {
	ChangeDetectionStrategy,
	Component,
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

	// T13: modo create apenas — `task` é ignorado; T14 o usará para edição.
	readonly task = input<Task | null>(null)
	// Preset de coluna (A fazer / Concluídas). T13 NÃO envia `completed` no DTO.
	readonly completedPreset = input(false)

	readonly cancelled = output<void>()
	readonly saved = output<void>()

	protected readonly submitting = signal(false)

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
			const native = this.dialog()?.nativeElement
			if (!native) return
			if (!native.open) native.showModal()
		})
	}

	protected onCancel(): void {
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
		const dto: CreateTaskDto = { description, title }
		this.store.add(dto)
		this.saved.emit()
	}
}
