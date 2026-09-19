import { TestBed } from '@angular/core/testing'
import { vi } from 'vitest'
import { ConfirmDialog } from './confirm-dialog'

describe('ConfirmDialog', () => {
	beforeEach(() => {
		vi.resetAllMocks()
		if (!HTMLDialogElement.prototype.showModal) {
			HTMLDialogElement.prototype.showModal = vi.fn()
		}
		if (!HTMLDialogElement.prototype.close) {
			HTMLDialogElement.prototype.close = vi.fn()
		}
		vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(
			function (this: HTMLDialogElement) {
				Object.defineProperty(this, 'open', { value: true })
			},
		)
		vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
			this: HTMLDialogElement,
		) {
			Object.defineProperty(this, 'open', { value: false })
		})
		TestBed.configureTestingModule({
			imports: [ConfirmDialog],
		})
	})

	async function openDialog() {
		const fixture = TestBed.createComponent(ConfirmDialog)
		fixture.componentRef.setInput('open', true)
		fixture.componentRef.setInput('taskTitle', 'Comprar leite')
		await fixture.whenStable()
		fixture.detectChanges()
		const confirmed = vi.fn()
		const cancelled = vi.fn()
		fixture.componentInstance.confirmed.subscribe(confirmed)
		fixture.componentInstance.cancelled.subscribe(cancelled)
		const dialog = fixture.nativeElement.querySelector(
			'dialog',
		) as HTMLDialogElement
		return { cancelled, confirmed, dialog, fixture }
	}

	function clickButton(dialog: HTMLDialogElement, label: string): void {
		const button = [...dialog.querySelectorAll('button')].find((el) =>
			el.textContent?.includes(label),
		)
		expect(button).not.toBeUndefined()
		button?.click()
	}

	it('click Excluir emite confirmed ×1 e cancelled ×0', async () => {
		const { cancelled, confirmed, dialog, fixture } = await openDialog()

		clickButton(dialog, 'Excluir')
		fixture.detectChanges()

		expect(confirmed).toHaveBeenCalledTimes(1)
		expect(cancelled).not.toHaveBeenCalled()
	})

	it('click Cancelar emite cancelled ×1 e confirmed ×0', async () => {
		const { cancelled, confirmed, dialog, fixture } = await openDialog()

		clickButton(dialog, 'Cancelar')
		fixture.detectChanges()

		expect(cancelled).toHaveBeenCalledTimes(1)
		expect(confirmed).not.toHaveBeenCalled()
	})

	it('Esc nativo emite cancelled ×1', async () => {
		const { cancelled, confirmed, dialog, fixture } = await openDialog()

		// fails if (close) binding removed (PR-22 regression test)
		dialog.dispatchEvent(new Event('close'))
		fixture.detectChanges()

		expect(cancelled).toHaveBeenCalledTimes(1)
		expect(confirmed).not.toHaveBeenCalled()
	})

	it("evento nativo 'cancel' emite cancelled ×1", async () => {
		const { cancelled, confirmed, dialog, fixture } = await openDialog()

		dialog.dispatchEvent(new Event('cancel'))
		fixture.detectChanges()

		expect(cancelled).toHaveBeenCalledTimes(1)
		expect(confirmed).not.toHaveBeenCalled()
	})
})
