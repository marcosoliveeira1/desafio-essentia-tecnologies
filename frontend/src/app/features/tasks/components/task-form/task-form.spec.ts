import { TestBed } from '@angular/core/testing'
import { ReactiveFormsModule } from '@angular/forms'
import { vi } from 'vitest'
import { TaskStoreService } from '../../../../core/services/task-store.service'
import { TaskForm } from './task-form'

describe('TaskForm', () => {
	const storeFake = {
		add: vi.fn(),
		update: vi.fn(),
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

	it('preset Concluídas chama store.add com completed:true', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance

		fixture.componentRef.setInput('completedPreset', true)
		fixture.detectChanges()
		await fixture.whenStable()
		fixture.detectChanges()

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
			completed: true,
		})
	})

	it('sem preset chama store.add sem a chave completed', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance

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
		expect('completed' in (storeFake.add.mock.calls[0][0] as object)).toBe(
			false,
		)
	})

	it('modo edição chama store.update com { title, description } exato (sem position)', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance
		const saved = vi.fn()
		component.saved.subscribe(saved)

		fixture.componentRef.setInput('task', {
			completed: false,
			createdAt: '2026-01-01T00:00:00.000Z',
			description: null,
			id: 1,
			position: 1,
			title: 'Antigo',
			updatedAt: '2026-01-01T00:00:00.000Z',
		})
		fixture.detectChanges()
		await fixture.whenStable()
		fixture.detectChanges()

		component.form.controls.title.setValue('Novo')
		component.form.controls.description.setValue('Desc')

		fixture.nativeElement
			.querySelector('form')
			.dispatchEvent(new Event('submit'))
		fixture.detectChanges()

		expect(storeFake.update).toHaveBeenCalledTimes(1)
		expect(storeFake.update).toHaveBeenCalledWith(1, {
			description: 'Desc',
			title: 'Novo',
		})
		expect(storeFake.update.mock.calls[0][1]).toEqual({
			description: 'Desc',
			title: 'Novo',
		})
		expect(storeFake.add).not.toHaveBeenCalled()
		expect(saved).toHaveBeenCalledTimes(1)
	})
})
