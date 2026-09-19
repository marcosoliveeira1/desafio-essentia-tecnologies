import { HttpErrorResponse } from '@angular/common/http'
import { TestBed } from '@angular/core/testing'
import { ReactiveFormsModule } from '@angular/forms'
import { Subject } from 'rxjs'
import { vi } from 'vitest'
import type { Task } from '../../../../core/models/task.model'
import { TaskStoreService } from '../../../../core/services/task-store.service'
import { TaskForm } from './task-form'

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		completed: false,
		createdAt: '2026-01-01T00:00:00.000Z',
		description: null,
		id: 1,
		position: 1,
		title: 'Antigo',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	}
}

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

	function submitForm(fixture: { nativeElement: HTMLElement }): void {
		fixture.nativeElement
			.querySelector('form')
			?.dispatchEvent(new Event('submit'))
	}

	it("título '' é inválido e não chama store.add", async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance

		component.form.controls.title.setValue('')
		component.form.controls.title.markAsTouched()

		expect(component.form.invalid).toBe(true)

		submitForm(fixture)
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

		submitForm(fixture)
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
		const gate = new Subject<Task>()
		storeFake.add.mockReturnValue(gate.asObservable())

		component.form.controls.title.setValue('  Estudar Angular  ')
		component.form.controls.description.setValue('  Revisar sinais  ')

		submitForm(fixture)
		fixture.detectChanges()

		expect(storeFake.add).toHaveBeenCalledTimes(1)
		expect(storeFake.add).toHaveBeenCalledWith({
			description: 'Revisar sinais',
			title: 'Estudar Angular',
		})
		expect(saved).not.toHaveBeenCalled()

		gate.next(makeTask({ id: 2, title: 'Estudar Angular' }))
		gate.complete()
		fixture.detectChanges()

		expect(saved).toHaveBeenCalledTimes(1)
	})

	it('preset Concluídas chama store.add com completed:true', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance

		fixture.componentRef.setInput('completedPreset', true)
		fixture.detectChanges()
		await fixture.whenStable()
		fixture.detectChanges()

		const gate = new Subject<Task>()
		storeFake.add.mockReturnValue(gate.asObservable())

		component.form.controls.title.setValue('  Estudar Angular  ')
		component.form.controls.description.setValue('  Revisar sinais  ')

		submitForm(fixture)
		fixture.detectChanges()

		expect(storeFake.add).toHaveBeenCalledTimes(1)
		expect(storeFake.add).toHaveBeenCalledWith({
			description: 'Revisar sinais',
			title: 'Estudar Angular',
			completed: true,
		})

		gate.next(makeTask({ completed: true, id: 2 }))
		gate.complete()
		fixture.detectChanges()
	})

	it('sem preset chama store.add sem a chave completed', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance

		const gate = new Subject<Task>()
		storeFake.add.mockReturnValue(gate.asObservable())

		component.form.controls.title.setValue('  Estudar Angular  ')
		component.form.controls.description.setValue('  Revisar sinais  ')

		submitForm(fixture)
		fixture.detectChanges()

		expect(storeFake.add).toHaveBeenCalledTimes(1)
		expect(storeFake.add).toHaveBeenCalledWith({
			description: 'Revisar sinais',
			title: 'Estudar Angular',
		})
		expect('completed' in (storeFake.add.mock.calls[0][0] as object)).toBe(
			false,
		)

		gate.next(makeTask({ id: 2 }))
		gate.complete()
		fixture.detectChanges()
	})

	it('modo edição chama store.update com { title, description } exato (sem position)', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance
		const saved = vi.fn()
		component.saved.subscribe(saved)

		fixture.componentRef.setInput('task', makeTask())
		fixture.detectChanges()
		await fixture.whenStable()
		fixture.detectChanges()

		const gate = new Subject<Task>()
		storeFake.update.mockReturnValue(gate.asObservable())

		component.form.controls.title.setValue('Novo')
		component.form.controls.description.setValue('Desc')

		submitForm(fixture)
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
		expect(saved).not.toHaveBeenCalled()

		gate.next(makeTask({ description: 'Desc', title: 'Novo' }))
		gate.complete()
		fixture.detectChanges()

		expect(saved).toHaveBeenCalledTimes(1)
	})

	it('falha no create: saved não emitido, alert visível, valores intactos, botão reabilitado', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance
		const saved = vi.fn()
		component.saved.subscribe(saved)
		const gate = new Subject<Task>()
		storeFake.add.mockReturnValue(gate.asObservable())

		component.form.controls.title.setValue('Nova tarefa')
		component.form.controls.description.setValue('Detalhes')

		submitForm(fixture)
		fixture.detectChanges()

		expect(
			(
				fixture.nativeElement.querySelector(
					'button[type="submit"]',
				) as HTMLButtonElement
			).disabled,
		).toBe(true)

		gate.error(
			new HttpErrorResponse({
				error: { code: 'VALIDATION_ERROR' },
				status: 400,
			}),
		)
		fixture.detectChanges()

		expect(saved).not.toHaveBeenCalled()
		const alert = fixture.nativeElement.querySelector('[role="alert"]')
		expect(alert).not.toBeNull()
		expect(alert?.textContent).toContain(
			'Verifique os dados e tente novamente.',
		)
		expect(component.form.controls.title.value).toBe('Nova tarefa')
		expect(component.form.controls.description.value).toBe('Detalhes')
		expect(
			(
				fixture.nativeElement.querySelector(
					'button[type="submit"]',
				) as HTMLButtonElement
			).disabled,
		).toBe(false)
	})

	it('API fora do ar (status 0, sem code) mostra mensagem fallback', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance
		const saved = vi.fn()
		component.saved.subscribe(saved)
		const gate = new Subject<Task>()
		storeFake.add.mockReturnValue(gate.asObservable())

		component.form.controls.title.setValue('Nova tarefa')
		component.form.controls.description.setValue('')

		submitForm(fixture)
		fixture.detectChanges()

		gate.error(new HttpErrorResponse({ status: 0 }))
		fixture.detectChanges()

		expect(saved).not.toHaveBeenCalled()
		expect(
			fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
		).toContain('Não foi possível salvar a tarefa. Tente novamente.')
		expect(
			(
				fixture.nativeElement.querySelector(
					'button[type="submit"]',
				) as HTMLButtonElement
			).disabled,
		).toBe(false)
	})

	it('falha no update (TASK_NOT_FOUND): dialog segue aberto com mensagem', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance
		const saved = vi.fn()
		component.saved.subscribe(saved)

		fixture.componentRef.setInput('task', makeTask())
		fixture.detectChanges()
		await fixture.whenStable()
		fixture.detectChanges()

		const gate = new Subject<Task>()
		storeFake.update.mockReturnValue(gate.asObservable())

		component.form.controls.title.setValue('Novo')
		component.form.controls.description.setValue('Desc')

		submitForm(fixture)
		fixture.detectChanges()

		gate.error(
			new HttpErrorResponse({
				error: { code: 'TASK_NOT_FOUND' },
				status: 404,
			}),
		)
		fixture.detectChanges()

		expect(saved).not.toHaveBeenCalled()
		expect(
			fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
		).toContain('Tarefa não encontrada. Recarregue a lista e tente novamente.')
		expect(component.form.controls.title.value).toBe('Novo')
		expect(
			(
				fixture.nativeElement.querySelector(
					'button[type="submit"]',
				) as HTMLButtonElement
			).disabled,
		).toBe(false)
	})

	it('sucesso emite saved somente após resolução do gate (create)', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance
		const saved = vi.fn()
		component.saved.subscribe(saved)
		const gate = new Subject<Task>()
		storeFake.add.mockReturnValue(gate.asObservable())

		component.form.controls.title.setValue('Nova')
		component.form.controls.description.setValue('')

		submitForm(fixture)
		fixture.detectChanges()

		expect(storeFake.add).toHaveBeenCalledTimes(1)
		expect(saved).not.toHaveBeenCalled()

		gate.next(makeTask({ id: 3, title: 'Nova' }))
		gate.complete()
		fixture.detectChanges()

		expect(saved).toHaveBeenCalledTimes(1)
	})

	it('sucesso emite saved somente após resolução do gate (update)', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance
		const saved = vi.fn()
		component.saved.subscribe(saved)

		fixture.componentRef.setInput('task', makeTask())
		fixture.detectChanges()
		await fixture.whenStable()
		fixture.detectChanges()

		const gate = new Subject<Task>()
		storeFake.update.mockReturnValue(gate.asObservable())

		component.form.controls.title.setValue('Novo')
		component.form.controls.description.setValue('Desc')

		submitForm(fixture)
		fixture.detectChanges()

		expect(storeFake.update).toHaveBeenCalledTimes(1)
		expect(saved).not.toHaveBeenCalled()

		gate.next(makeTask({ title: 'Novo' }))
		gate.complete()
		fixture.detectChanges()

		expect(saved).toHaveBeenCalledTimes(1)
	})

	it('spinner visível e botões desabilitados durante voo; some após sucesso', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance
		const gate = new Subject<Task>()
		storeFake.add.mockReturnValue(gate.asObservable())

		component.form.controls.title.setValue('Nova')
		component.form.controls.description.setValue('')

		submitForm(fixture)
		fixture.detectChanges()

		const submitBtn = fixture.nativeElement.querySelector(
			'button[type="submit"]',
		) as HTMLButtonElement
		const cancelBtn = fixture.nativeElement.querySelector(
			'button[type="button"]',
		) as HTMLButtonElement
		expect(submitBtn.disabled).toBe(true)
		expect(cancelBtn.disabled).toBe(true)
		expect(
			fixture.nativeElement.querySelector('span.animate-spin'),
		).not.toBeNull()

		gate.next(makeTask({ id: 5 }))
		gate.complete()
		fixture.detectChanges()

		expect(
			(
				fixture.nativeElement.querySelector(
					'button[type="submit"]',
				) as HTMLButtonElement
			).disabled,
		).toBe(false)
		expect(fixture.nativeElement.querySelector('span.animate-spin')).toBeNull()
	})

	it('duplo submit com gate aberto chama add exatamente uma vez', async () => {
		const fixture = await createForm()
		const component = fixture.componentInstance
		const gate = new Subject<Task>()
		storeFake.add.mockReturnValue(gate.asObservable())

		component.form.controls.title.setValue('Nova')
		component.form.controls.description.setValue('')

		submitForm(fixture)
		fixture.detectChanges()
		submitForm(fixture)
		fixture.detectChanges()

		expect(storeFake.add).toHaveBeenCalledTimes(1)

		gate.next(makeTask({ id: 6 }))
		gate.complete()
		fixture.detectChanges()
	})
})
