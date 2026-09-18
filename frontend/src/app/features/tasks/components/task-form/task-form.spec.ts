import { TestBed } from '@angular/core/testing'
import { ReactiveFormsModule } from '@angular/forms'
import { vi } from 'vitest'
import { TaskStoreService } from '../../../../core/services/task-store.service'
import { TaskForm } from './task-form'

describe('TaskForm', () => {
	const storeFake = {
		add: vi.fn(),
	}

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
		TestBed.configureTestingModule({
			imports: [ReactiveFormsModule, TaskForm],
			providers: [{ provide: TaskStoreService, useValue: storeFake }],
		})
	})

	async function createForm() {
		const fixture = TestBed.createComponent(TaskForm)
		await fixture.whenStable()
		fixture.detectChanges()
		return fixture
	}

	it("título '' é inválido e não chama store.add", async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance

		component.form.controls.title.setValue('')
		component.form.controls.title.markAsTouched()

		expect(component.form.invalid).toBe(true)

		fixture.nativeElement
			.querySelector('form')
			.dispatchEvent(new Event('submit'))
		fixture.detectChanges()

		expect(storeFake.add).not.toHaveBeenCalled()
		expect(
			fixture.nativeElement.querySelector('p.text-red-500')?.textContent,
		).toContain('Título obrigatório')
	})

	it("título '   ' (whitespace-only) é inválido e não chama store.add", async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance

		component.form.controls.title.setValue('   ')
		component.form.controls.title.markAsTouched()

		expect(component.form.invalid).toBe(true)

		fixture.nativeElement
			.querySelector('form')
			.dispatchEvent(new Event('submit'))
		fixture.detectChanges()

		expect(storeFake.add).not.toHaveBeenCalled()
		expect(
			fixture.nativeElement.querySelector('p.text-red-500')?.textContent,
		).toContain('Título obrigatório')
	})

	it('título válido com espaços chama store.add com trim e emite saved', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance
		const saved = vi.fn()
		component.saved.subscribe(saved)

		component.form.controls.title.setValue('  Estudar Angular  ')
		component.form.controls.description.setValue('  Revisar sinais  ')

		fixture.nativeElement
			.querySelector('form')
			.dispatchEvent(new Event('submit'))
		fixture.detectChanges()

		expect(storeFake.add).toHaveBeenCalledTimes(1)
		expect(storeFake.add).toHaveBeenCalledWith({
			description: 'Revisar sinais',
			title: 'Estudar Angular',
		})
		expect(saved).toHaveBeenCalledTimes(1)
	})
})
