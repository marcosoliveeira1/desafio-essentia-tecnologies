import {
	ChangeDetectionStrategy,
	Component,
	type ElementRef,
	effect,
	input,
	output,
	viewChild,
} from '@angular/core'

@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	selector: 'app-confirm-dialog',
	styleUrl: './confirm-dialog.css',
	templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
	readonly open = input(false)
	readonly taskTitle = input<string | null>(null)
	readonly confirmed = output<void>()
	readonly cancelled = output<void>()

	protected readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog')

	constructor() {
		effect(() => {
			const native = this.dialog()?.nativeElement
			if (!native) return
			if (this.open() && !native.open) native.showModal()
			if (!this.open() && native.open) native.close()
		})
	}

	protected onCancel(): void {
		this.cancelled.emit()
	}

	protected onConfirm(): void {
		this.confirmed.emit()
	}
}
