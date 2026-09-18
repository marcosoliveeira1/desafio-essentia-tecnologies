import { TestBed } from '@angular/core/testing'
import { of, throwError } from 'rxjs'
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

		store.add({ title: 'Nova' })

		expect(store.tasks()).toEqual([created, makeTask({ id: 1 })])
		expect(store.loading()).toBe(false)
		expect(spyObj.create).toHaveBeenCalledTimes(1)
	})

	it('update substitui a tarefa pelo retorno da API', () => {
		store.tasks.set([makeTask({ id: 1, title: 'Antigo' })])
		const updated = makeTask({ id: 1, title: 'Novo' })
		spyObj.update.mockReturnValue(of(updated))

		store.update(1, { title: 'Novo' })

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

	it('move na mesma coluna reordena local sem chamada HTTP', () => {
		const first = makeTask({ id: 1 })
		const second = makeTask({ id: 2 })
		store.tasks.set([first, second])
		spyObj.update.mockReturnValue(of(first))

		store.move(1, false)

		expect(spyObj.update).not.toHaveBeenCalled()
		expect(store.tasks().map((task) => task.id)).toEqual([2, 1])
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
		store.add({ title: 'X' })
		expect(store.error()).toBe(
			'Não foi possível criar a tarefa. Tente novamente.',
		)

		spyObj.update.mockReturnValue(throwError(() => new Error('fail')))
		store.update(1, { title: 'Y' })
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
})
