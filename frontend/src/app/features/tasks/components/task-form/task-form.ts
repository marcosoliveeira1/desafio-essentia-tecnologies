import { HttpErrorResponse } from '@angular/common/http'
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
import type { AbstractControl, ValidationErrors } from '@angular/forms'
import {
	FormControl,
	FormGroup,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms'
import type { Observable } from 'rxjs'
import {
	type CreateTaskDto,
	DESCRIPTION_MAX,
	type Task,
	TITLE_MAX,
} from '../../../../core/models/task.model'
import { TaskStoreService } from '../../../../core/services/task-store.service'

function noWhitespaceValidator(
	control: AbstractControl,
): ValidationErrors | null {
	const value = (control.value as string | null) ?? ''
	return value.trim().length > 0 ? null : { whitespace: true }
}

const MSG_FORM_VALIDATION = 'Verifique os dados e tente novamente.'
const MSG_FORM_NOT_FOUND =
	'Tarefa não encontrada. Recarregue a lista e tente novamente.'
const MSG_FORM_FALLBACK = 'Não foi possível salvar a tarefa. Tente novamente.'

function formErrorCode(err: unknown): string | null {
	if (
		err instanceof HttpErrorResponse &&
		err.error !== null &&
		typeof err.error === 'object' &&
		'code' in err.error
	) {
		const code = (err.error as { code?: unknown }).code
		return typeof code === 'string' ? code : null
	}
	return null
}

function formErrorMessage(err: unknown): string {
	if (err instanceof HttpErrorResponse) {
		const code = formErrorCode(err)
		if (code === 'VALIDATION_ERROR') return MSG_FORM_VALIDATION
		if (code === 'TASK_NOT_FOUND') return MSG_FORM_NOT_FOUND
		if (err.status === 400) return MSG_FORM_VALIDATION
	}
	return MSG_FORM_FALLBACK
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

	readonly task = input<Task | null>(null)
	readonly completedPreset = input(false)

	readonly cancelled = output<void>()
	readonly saved = output<void>()

	protected readonly submitting = signal(false)
	protected readonly formError = signal<string | null>(null)
	protected readonly isEditing = computed(() => this.task() !== null)

	protected readonly titleMax = TITLE_MAX
	protected readonly descriptionMax = DESCRIPTION_MAX

	readonly form = new FormGroup({
		description: new FormControl('', {
			nonNullable: true,
			validators: [Validators.maxLength(DESCRIPTION_MAX)],
		}),
		title: new FormControl('', {
			nonNullable: true,
			validators: [
				Validators.required,
				Validators.maxLength(TITLE_MAX),
				noWhitespaceValidator,
			],
		}),
	})

	protected readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog')

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
		if (this.submitting()) return
		this.formError.set(null)
		this.submitting.set(true)
		const rawTitle = this.form.controls.title.value
		const rawDescription = this.form.controls.description.value
		const title = rawTitle.trim()
		const description = rawDescription.trim() || null
		const current = this.task()
		let request$: Observable<Task>
		if (current) {
			request$ = this.store.update(current.id, { description, title })
		} else {
			const dto: CreateTaskDto = { description, title }
			if (this.completedPreset()) dto.completed = true
			request$ = this.store.add(dto)
		}
		request$.subscribe({
			error: (err: unknown) => {
				this.submitting.set(false)
				this.formError.set(formErrorMessage(err))
			},
			next: () => {
				this.submitting.set(false)
				this.saved.emit()
			},
		})
	}
}
