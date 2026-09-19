import { TestBed } from '@angular/core/testing'
import { of, Subject, throwError } from 'rxjs'
import { vi } from 'vitest'
import type { Task } from '../models/task.model'
import { TaskApiService } from './task-api.service'
import { TaskStoreService } from './task-store.service'

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		completed: false,
		createdAt: '2026-01-01T00:00:00.000Z',
		description: null,
		id: 1,
		position: 1,
		title: 'Estudar Angular',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	}
}

describe('TaskStoreService', () => {
	let store: TaskStoreService
	const spyObj = {
		create: vi.fn(),
		list: vi.fn(),
		remove: vi.fn(),
		reorder: vi.fn(),
		update: vi.fn(),
	}

	beforeEach(() => {
		vi.resetAllMocks()
		TestBed.configureTestingModule({
			providers: [{ provide: TaskApiService, useValue: spyObj }],
		})
		store = TestBed.inject(TaskStoreService)
	})

	it('load popula tasks via api.list', () => {
		const tasks = [makeTask(), makeTask({ id: 2, title: 'Outra' })]
		spyObj.list.mockReturnValue(of(tasks))

		store.load()

		expect(store.tasks()).toEqual(tasks)
		expect(store.loading()).toBe(false)
		expect(store.error()).toBeNull()
		expect(spyObj.list).toHaveBeenCalledTimes(1)
	})

	it('add insere a nova tarefa no início', () => {
		store.tasks.set([makeTask({ id: 1 })])
		const created = makeTask({ id: 2, title: 'Nova' })
		spyObj.create.mockReturnValue(of(created))

		store.add({ title: 'Nova' }).subscribe()

		expect(store.tasks()).toEqual([created, makeTask({ id: 1 })])
		expect(store.loading()).toBe(false)
		expect(spyObj.create).toHaveBeenCalledTimes(1)
	})

	it('update substitui a tarefa pelo retorno da API', () => {
		store.tasks.set([makeTask({ id: 1, title: 'Antigo' })])
		const updated = makeTask({ id: 1, title: 'Novo' })
		spyObj.update.mockReturnValue(of(updated))

		store.update(1, { title: 'Novo' }).subscribe()

		expect(store.tasks()).toEqual([updated])
		expect(spyObj.update).toHaveBeenCalledWith(1, { title: 'Novo' })
	})

	it('toggle inverte completed via api.update', () => {
		store.tasks.set([makeTask({ completed: false, id: 1 })])
		const updated = makeTask({ completed: true, id: 1 })
		spyObj.update.mockReturnValue(of(updated))

		store.toggle(1)

		expect(spyObj.update).toHaveBeenCalledWith(1, { completed: true })
		expect(store.tasks()).toEqual([updated])
	})

	it('remove exclui a tarefa da lista', () => {
		store.tasks.set([makeTask({ id: 1 }), makeTask({ id: 2 })])
		spyObj.remove.mockReturnValue(of(undefined))

		store.remove(1)

		expect(store.tasks()).toEqual([makeTask({ id: 2 })])
		expect(spyObj.remove).toHaveBeenCalledWith(1)
	})

	it('move entre colunas faz PATCH só com { completed }, sem position', () => {
		store.tasks.set([makeTask({ completed: false, id: 1 })])
		const updated = makeTask({ completed: true, id: 1 })
		spyObj.update.mockReturnValue(of(updated))

		store.move(1, true)

		expect(spyObj.update).toHaveBeenCalledTimes(1)
		expect(spyObj.update).toHaveBeenCalledWith(1, { completed: true })
		expect(spyObj.update.mock.calls[0][1]).toEqual({ completed: true })
		expect(store.tasks()).toEqual([updated])
	})

	it('move na mesma coluna é no-op (sem chamada HTTP)', () => {
		store.tasks.set([
			makeTask({ id: 1, position: 1 }),
			makeTask({ id: 2, position: 5 }),
		])

		store.move(1, false)

		expect(spyObj.update).not.toHaveBeenCalled()
		expect(store.tasks()).toEqual([
			makeTask({ id: 1, position: 1 }),
			makeTask({ id: 2, position: 5 }),
		])
		expect(store.loading()).toBe(false)
		expect(store.error()).toBeNull()
	})

	it('reorder substitui tasks pelo retorno da API', () => {
		store.tasks.set([makeTask({ id: 1 }), makeTask({ id: 2 })])
		const reordered = [makeTask({ id: 2 }), makeTask({ id: 1 })]
		spyObj.reorder.mockReturnValue(of(reordered))

		store.reorder([2, 1])

		expect(spyObj.reorder).toHaveBeenCalledTimes(1)
		expect(spyObj.reorder).toHaveBeenCalledWith([2, 1])
		expect(store.tasks()).toEqual(reordered)
		expect(store.loading()).toBe(false)
		expect(store.error()).toBeNull()
	})

	it('reorder com lista vazia é no-op (sem chamada HTTP)', () => {
		const before = [makeTask({ id: 1 })]
		store.tasks.set(before)

		store.reorder([])

		expect(spyObj.reorder).not.toHaveBeenCalled()
		expect(store.tasks()).toEqual(before)
	})

	it('erro no reorder seta mensagem PT-BR e preserva tasks', () => {
		const before = [makeTask({ id: 1 }), makeTask({ id: 2 })]
		store.tasks.set(before)
		spyObj.reorder.mockReturnValue(throwError(() => new Error('fail')))

		store.reorder([2, 1])

		expect(spyObj.reorder).toHaveBeenCalledTimes(1)
		expect(spyObj.reorder).toHaveBeenCalledWith([2, 1])
		expect(store.error()).toBe(
			'Não foi possível reordenar as tarefas. Tente novamente.',
		)
		expect(store.tasks()).toEqual(before)
		expect(store.loading()).toBe(false)
	})

	it('filter pendentes/concluídas sem nova chamada HTTP', () => {
		spyObj.list.mockReturnValue(
			of([makeTask({ id: 1 }), makeTask({ completed: true, id: 2 })]),
		)
		store.load()
		expect(spyObj.list).toHaveBeenCalledTimes(1)

		store.setFilter('pending')
		expect(store.filteredTasks().map((task) => task.id)).toEqual([1])

		store.setFilter('done')
		expect(store.filteredTasks().map((task) => task.id)).toEqual([2])

		expect(spyObj.list).toHaveBeenCalledTimes(1)
	})

	it('search filtra título/descrição case-insensitive sem nova chamada', () => {
		spyObj.list.mockReturnValue(
			of([
				makeTask({ description: 'Comprar LEITE', id: 1, title: 'Mercado' }),
				makeTask({ description: null, id: 2, title: 'Academia' }),
			]),
		)
		store.load()

		store.setSearch('  leite  ')
		expect(store.filteredTasks().map((task) => task.id)).toEqual([1])

		store.setSearch('ACADEMIA')
		expect(store.filteredTasks().map((task) => task.id)).toEqual([2])

		expect(spyObj.list).toHaveBeenCalledTimes(1)
	})

	it('sort recent/old ordena sem nova chamada HTTP', () => {
		spyObj.list.mockReturnValue(
			of([
				makeTask({ createdAt: '2026-01-01T00:00:00.000Z', id: 1 }),
				makeTask({ createdAt: '2026-03-01T00:00:00.000Z', id: 2 }),
				makeTask({ createdAt: '2026-02-01T00:00:00.000Z', id: 3 }),
			]),
		)
		store.load()

		store.setSort('recent')
		expect(store.filteredTasks().map((task) => task.id)).toEqual([2, 3, 1])

		store.setSort('old')
		expect(store.filteredTasks().map((task) => task.id)).toEqual([1, 3, 2])

		expect(spyObj.list).toHaveBeenCalledTimes(1)
	})

	it('contadores total/pendentes/concluídas', () => {
		store.tasks.set([
			makeTask({ id: 1 }),
			makeTask({ completed: true, id: 2 }),
			makeTask({ completed: true, id: 3 }),
		])

		expect(store.totalCount()).toBe(3)
		expect(store.pendingCount()).toBe(1)
		expect(store.doneCount()).toBe(2)
	})

	it('erro no load seta mensagem PT-BR e preserva tasks', () => {
		const before = [makeTask({ id: 1 })]
		store.tasks.set(before)
		spyObj.list.mockReturnValue(throwError(() => new Error('fail')))

		store.load()

		expect(store.error()).toBe(
			'Não foi possível carregar as tarefas. Tente novamente.',
		)
		expect(store.tasks()).toEqual(before)
		expect(store.loading()).toBe(false)
	})

	it('erro no toggle seta mensagem PT-BR e preserva tasks', () => {
		const before = [makeTask({ completed: false, id: 1 })]
		store.tasks.set(before)
		spyObj.update.mockReturnValue(throwError(() => new Error('fail')))

		store.toggle(1)

		expect(store.error()).toBe(
			'Não foi possível alterar o status da tarefa. Tente novamente.',
		)
		expect(store.tasks()).toEqual(before)
		expect(store.loading()).toBe(false)
	})

	it('erros de add/update/remove com mensagens PT-BR e clearError limpa', () => {
		spyObj.create.mockReturnValue(throwError(() => new Error('fail')))
		store.add({ title: 'X' }).subscribe({ error: () => undefined })
		expect(store.error()).toBe(
			'Não foi possível criar a tarefa. Tente novamente.',
		)

		spyObj.update.mockReturnValue(throwError(() => new Error('fail')))
		store.update(1, { title: 'Y' }).subscribe({ error: () => undefined })
		expect(store.error()).toBe(
			'Não foi possível atualizar a tarefa. Tente novamente.',
		)

		spyObj.remove.mockReturnValue(throwError(() => new Error('fail')))
		store.remove(1)
		expect(store.error()).toBe(
			'Não foi possível excluir a tarefa. Tente novamente.',
		)

		store.clearError()
		expect(store.error()).toBeNull()
	})

	it('toggle otimista: inverte de imediato, usa pending sem loading', () => {
		store.tasks.set([makeTask({ completed: false, id: 1 })])
		const gate = new Subject<Task>()
		spyObj.update.mockReturnValue(gate.asObservable())

		store.toggle(1)

		expect(store.tasks()[0].completed).toBe(true)
		expect(store.loading()).toBe(false)
		expect(store.isPending('toggle:1')).toBe(true)

		const confirmed = makeTask({ completed: true, id: 1 })
		gate.next(confirmed)
		gate.complete()

		expect(store.tasks()).toEqual([confirmed])
		expect(store.isPending('toggle:1')).toBe(false)
		expect(store.loading()).toBe(false)
	})

	it('toggle falha: rollback para snapshot, MSG_TOGGLE e limpa pending', () => {
		const before = [makeTask({ completed: false, id: 1 })]
		store.tasks.set(before)
		const gate = new Subject<Task>()
		spyObj.update.mockReturnValue(gate.asObservable())

		store.toggle(1)
		expect(store.tasks()[0].completed).toBe(true)

		gate.error(new Error('fail'))

		expect(store.tasks()).toEqual(before)
		expect(store.error()).toBe(
			'Não foi possível alterar o status da tarefa. Tente novamente.',
		)
		expect(store.isPending('toggle:1')).toBe(false)
		expect(store.loading()).toBe(false)
	})

	it('double load: último payload vence (ordem 1→2)', () => {
		const first = new Subject<Task[]>()
		const second = new Subject<Task[]>()
		spyObj.list.mockReturnValueOnce(first.asObservable())
		spyObj.list.mockReturnValueOnce(second.asObservable())
		const payload1 = [makeTask({ id: 1 })]
		const payload2 = [makeTask({ id: 2 })]

		store.load()
		store.load()

		first.next(payload1)
		second.next(payload2)

		expect(store.tasks()).toEqual(payload2)
		expect(store.loading()).toBe(false)
	})

	it('double load: último payload vence (ordem 2→1)', () => {
		const first = new Subject<Task[]>()
		const second = new Subject<Task[]>()
		spyObj.list.mockReturnValueOnce(first.asObservable())
		spyObj.list.mockReturnValueOnce(second.asObservable())
		const payload1 = [makeTask({ id: 1 })]
		const payload2 = [makeTask({ id: 2 })]

		store.load()
		store.load()

		second.next(payload2)
		first.next(payload1)

		expect(store.tasks()).toEqual(payload2)
		expect(store.loading()).toBe(false)
	})

	it('toggle/reorder em voo não aciona skeleton (loading false)', () => {
		store.tasks.set([makeTask({ id: 1 }), makeTask({ id: 2 })])
		const toggleGate = new Subject<Task>()
		spyObj.update.mockReturnValue(toggleGate.asObservable())

		store.toggle(1)

		expect(store.pending().size).toBeGreaterThan(0)
		expect(store.loading()).toBe(false)
		toggleGate.next(makeTask({ completed: true, id: 1 }))
		toggleGate.complete()

		const reorderGate = new Subject<Task[]>()
		spyObj.reorder.mockReturnValue(reorderGate.asObservable())
		store.reorder([2, 1])

		expect(store.isPending('reorder')).toBe(true)
		expect(store.loading()).toBe(false)
		reorderGate.next([makeTask({ id: 2 }), makeTask({ id: 1 })])
		reorderGate.complete()
		expect(store.isPending('reorder')).toBe(false)
		expect(store.loading()).toBe(false)
	})

	it('move reutiliza a chave toggle:<id>', () => {
		store.tasks.set([makeTask({ completed: false, id: 1 })])
		const gate = new Subject<Task>()
		spyObj.update.mockReturnValue(gate.asObservable())

		store.move(1, true)

		expect(store.tasks()[0].completed).toBe(true)
		expect(store.isPending('toggle:1')).toBe(true)
		expect(store.loading()).toBe(false)

		gate.next(makeTask({ completed: true, id: 1 }))
		gate.complete()

		expect(store.isPending('toggle:1')).toBe(false)
		expect(store.tasks()).toEqual([makeTask({ completed: true, id: 1 })])
	})

	it('add/update/remove usam pending keys sem loading', () => {
		const createGate = new Subject<Task>()
		spyObj.create.mockReturnValue(createGate.asObservable())
		store.add({ title: 'Nova' }).subscribe()
		expect(store.isPending('create')).toBe(true)
		expect(store.loading()).toBe(false)
		createGate.next(makeTask({ id: 9, title: 'Nova' }))
		createGate.complete()
		expect(store.isPending('create')).toBe(false)
		expect(store.loading()).toBe(false)

		store.tasks.set([makeTask({ id: 1, title: 'Antigo' })])
		const updateGate = new Subject<Task>()
		spyObj.update.mockReturnValue(updateGate.asObservable())
		store.update(1, { title: 'Novo' }).subscribe()
		expect(store.isPending('update:1')).toBe(true)
		expect(store.loading()).toBe(false)
		updateGate.next(makeTask({ id: 1, title: 'Novo' }))
		updateGate.complete()
		expect(store.isPending('update:1')).toBe(false)

		const removeGate = new Subject<void>()
		spyObj.remove.mockReturnValue(removeGate.asObservable())
		store.remove(1)
		expect(store.isPending('delete:1')).toBe(true)
		expect(store.loading()).toBe(false)
		removeGate.next(undefined)
		removeGate.complete()
		expect(store.isPending('delete:1')).toBe(false)
		expect(store.loading()).toBe(false)
	})

	it('add retorna observable que resolve com criada e limpa pending', () => {
		store.tasks.set([makeTask({ id: 1 })])
		const created = makeTask({ id: 2, title: 'Nova' })
		const gate = new Subject<Task>()
		spyObj.create.mockReturnValue(gate.asObservable())

		let resolved: Task | null = null
		store.add({ title: 'Nova' }).subscribe((task) => {
			resolved = task
		})

		expect(store.isPending('create')).toBe(true)
		expect(resolved).toBeNull()

		gate.next(created)
		gate.complete()

		expect(resolved).toEqual(created)
		expect(store.tasks()).toEqual([created, makeTask({ id: 1 })])
		expect(store.isPending('create')).toBe(false)
		expect(store.error()).toBeNull()
	})

	it('update retorna observable que resolve com atualizada e limpa pending', () => {
		store.tasks.set([makeTask({ id: 1, title: 'Antigo' })])
		const updated = makeTask({ id: 1, title: 'Novo' })
		const gate = new Subject<Task>()
		spyObj.update.mockReturnValue(gate.asObservable())

		let resolved: Task | null = null
		store.update(1, { title: 'Novo' }).subscribe((task) => {
			resolved = task
		})

		expect(store.isPending('update:1')).toBe(true)
		expect(resolved).toBeNull()

		gate.next(updated)
		gate.complete()

		expect(resolved).toEqual(updated)
		expect(store.tasks()).toEqual([updated])
		expect(store.isPending('update:1')).toBe(false)
		expect(store.error()).toBeNull()
	})

	it('erro no add propaga ao subscriber, seta error e limpa pending', () => {
		const before = [makeTask({ id: 1 })]
		store.tasks.set(before)
		const failure = new Error('fail')
		spyObj.create.mockReturnValue(throwError(() => failure))

		let received: unknown = null
		store.add({ title: 'X' }).subscribe({ error: (err) => (received = err) })

		expect(received).toBe(failure)
		expect(store.error()).toBe(
			'Não foi possível criar a tarefa. Tente novamente.',
		)
		expect(store.isPending('create')).toBe(false)
		expect(store.tasks()).toEqual(before)
	})

	it('erro no update propaga ao subscriber, seta error e limpa pending', () => {
		const before = [makeTask({ id: 1, title: 'Antigo' })]
		store.tasks.set(before)
		const failure = new Error('fail')
		spyObj.update.mockReturnValue(throwError(() => failure))

		let received: unknown = null
		store
			.update(1, { title: 'Y' })
			.subscribe({ error: (err) => (received = err) })

		expect(received).toBe(failure)
		expect(store.error()).toBe(
			'Não foi possível atualizar a tarefa. Tente novamente.',
		)
		expect(store.isPending('update:1')).toBe(false)
		expect(store.tasks()).toEqual(before)
	})

	it('clear limpa pending (logout)', () => {
		const gate = new Subject<Task>()
		spyObj.update.mockReturnValue(gate.asObservable())
		store.tasks.set([makeTask({ id: 1 })])
		store.toggle(1)
		expect(store.pending().size).toBeGreaterThan(0)

		store.clear()

		expect(store.pending().size).toBe(0)
		expect(store.tasks()).toEqual([])
		gate.next(makeTask({ completed: true, id: 1 }))
	})
})
