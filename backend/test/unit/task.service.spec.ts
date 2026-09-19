import type { DataSource } from 'typeorm'
import { FindOperator } from 'typeorm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
	IActivityRepository,
	RecordActivityInput,
} from '../../src/modules/activity/activity.repository.js'
import type { ActivityLogEntity } from '../../src/modules/activity/activity-log.entity.js'
import { InMemoryTaskRepository } from '../../src/modules/tasks/in-memory-task.repository.js'
import type { TaskEntity } from '../../src/modules/tasks/task.entity.js'
import type {
	CreateTaskInput,
	UpdateTaskInput,
} from '../../src/modules/tasks/task.repository.js'
import { TaskService } from '../../src/modules/tasks/task.service.js'
import { TypeOrmTaskRepository } from '../../src/modules/tasks/typeorm-task.repository.js'
import { NotFoundError } from '../../src/shared/errors/not-found.error.js'
import { ValidationError } from '../../src/shared/errors/validation.error.js'

const USER_A = 1
const USER_B = 2

class RecordingActivityRepository implements IActivityRepository {
	readonly calls: RecordActivityInput[] = []
	failOnce = false

	async record(input: RecordActivityInput): Promise<ActivityLogEntity> {
		if (this.failOnce) {
			throw new Error('activity down')
		}
		this.calls.push(input)
		return {
			taskId: input.taskId,
			action: input.action,
		} as unknown as ActivityLogEntity
	}

	async findByTask(): Promise<ActivityLogEntity[]> {
		return []
	}

	async findByUser(): Promise<ActivityLogEntity[]> {
		return []
	}
}

describe('TaskService (unit, repo in-memory)', () => {
	let repo: InMemoryTaskRepository
	let service: TaskService

	beforeEach(() => {
		repo = new InMemoryTaskRepository()
		service = new TaskService(repo)
	})

	it('cria tarefa válida (completed nasce false)', async () => {
		const task = await service.create(USER_A, {
			title: 'Estudar',
			description: 'Cap 3',
		})
		expect(task.id).toBeGreaterThan(0)
		expect(task.title).toBe('Estudar')
		expect(task.description).toBe('Cap 3')
		expect(task.completed).toBe(false)
		expect(task.createdAt).toBeInstanceOf(Date)
	})

	it('cria tarefa sem description (null)', async () => {
		const task = await service.create(USER_A, { title: 'Só título' })
		expect(task.description).toBeNull()
	})

	it('cria com description null explícito (normaliza, sem 400)', async () => {
		const task = await service.create(USER_A, {
			title: 't',
			description: null,
		})
		expect(task.description).toBeNull()
	})

	it('create rejeita input não-objeto (400)', async () => {
		await expect(
			service.create(USER_A, undefined as unknown as CreateTaskInput),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('cria com trim no title', async () => {
		const task = await service.create(USER_A, { title: '  Comprar pão  ' })
		expect(task.title).toBe('Comprar pão')
	})

	it('rejeita título vazio (400)', async () => {
		await expect(service.create(USER_A, { title: '' })).rejects.toMatchObject({
			statusCode: 400,
			code: 'VALIDATION_ERROR',
		})
	})

	it('rejeita título whitespace-only F3 (400)', async () => {
		await expect(
			service.create(USER_A, { title: '    ' }),
		).rejects.toBeInstanceOf(ValidationError)
		await expect(
			service.create(USER_A, { title: '  \t\n ' }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('rejeita título com mais de 255 chars (400)', async () => {
		await expect(
			service.create(USER_A, { title: 'x'.repeat(256) }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('rejeita description com mais de 2000 chars (400)', async () => {
		await expect(
			service.create(USER_A, { title: 'ok', description: 'y'.repeat(2001) }),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
	})

	it('create com completed:true nasce concluída (PR-18b)', async () => {
		const task = await service.create(USER_A, {
			title: 'já feita',
			completed: true,
		})
		expect(task.completed).toBe(true)
	})

	it('create com completed:false explícito nasce pendente', async () => {
		const task = await service.create(USER_A, {
			title: 'a fazer',
			completed: false,
		})
		expect(task.completed).toBe(false)
	})

	it('getById retorna a tarefa (M1)', async () => {
		const created = await service.create(USER_A, { title: 'buscar' })
		const found = await service.getById(USER_A, created.id)
		expect(found.title).toBe('buscar')
	})

	it('getById de id inexistente → 404 TASK_NOT_FOUND', async () => {
		await expect(service.getById(USER_A, 999)).rejects.toMatchObject({
			statusCode: 404,
			code: 'TASK_NOT_FOUND',
			message: 'Tarefa não encontrada',
		})
	})

	it('getById de id inválido → 400', async () => {
		await expect(service.getById(USER_A, 0)).rejects.toBeInstanceOf(
			ValidationError,
		)
		await expect(service.getById(USER_A, Number.NaN)).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
	})

	it('update parcial altera só o campo enviado', async () => {
		const created = await service.create(USER_A, {
			title: 'orig',
			description: 'desc',
		})
		const updated = await service.update(USER_A, created.id, {
			description: 'nova',
		})
		expect(updated.description).toBe('nova')
		expect(updated.title).toBe('orig')
		expect(updated.completed).toBe(false)
	})

	it('toggle de completed preserva os demais campos', async () => {
		const created = await service.create(USER_A, {
			title: 't',
			description: 'd',
		})
		const done = await service.update(USER_A, created.id, { completed: true })
		expect(done.completed).toBe(true)
		expect(done.title).toBe('t')
		expect(done.description).toBe('d')
		const undone = await service.update(USER_A, created.id, {
			completed: false,
		})
		expect(undone.completed).toBe(false)
	})

	it('update de id inexistente → 404', async () => {
		await expect(
			service.update(USER_A, 4242, { title: 'x' }),
		).rejects.toBeInstanceOf(NotFoundError)
	})

	it('update com body vazio → 400', async () => {
		const created = await service.create(USER_A, { title: 'x' })
		await expect(service.update(USER_A, created.id, {})).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
	})

	it('update rejeita patch não-objeto (string → 400)', async () => {
		const created = await service.create(USER_A, { title: 'x' })
		await expect(
			service.update(USER_A, created.id, 'x' as unknown as UpdateTaskInput),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('update rejeita title whitespace-only (400)', async () => {
		const created = await service.create(USER_A, { title: 'x' })
		await expect(
			service.update(USER_A, created.id, { title: '   ' }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('update rejeita tipos errados (completed string → 400)', async () => {
		const created = await service.create(USER_A, { title: 'x' })
		await expect(
			service.update(USER_A, created.id, {
				completed: 'yes' as unknown as boolean,
			}),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
	})

	it('remove exclui e getById posterior dá 404', async () => {
		const created = await service.create(USER_A, { title: 'bye' })
		await service.remove(USER_A, created.id)
		await expect(service.getById(USER_A, created.id)).rejects.toMatchObject({
			code: 'TASK_NOT_FOUND',
		})
	})

	it('remove de id inexistente → 404', async () => {
		await expect(service.remove(USER_A, 777)).rejects.toMatchObject({
			code: 'TASK_NOT_FOUND',
			message: 'Tarefa não encontrada',
		})
	})

	it('list retorna em ordem crescente de position (desempate por id)', async () => {
		const a = await service.create(USER_A, { title: 'a' })
		const b = await service.create(USER_A, { title: 'b' })
		const c = await service.create(USER_A, { title: 'c' })
		const list = await service.list(USER_A)
		expect(list.map((t) => t.id)).toEqual([a.id, b.id, c.id])
		expect(list.map((t) => t.position)).toEqual([1, 2, 3])
	})

	it('create recebe max+1 global', async () => {
		const a = await service.create(USER_A, { title: 'a' })
		const b = await service.create(USER_A, { title: 'b' })
		expect(a.position).toBe(1)
		expect(b.position).toBe(2)
		await service.remove(USER_A, a.id)
		const c = await service.create(USER_A, { title: 'c' })
		expect(c.position).toBe(3)
	})

	it('create ignora position enviado pelo cliente', async () => {
		const task = await service.create(USER_A, { title: 'x', position: 99 })
		expect(task.position).toBe(1)
		const other = await service.create(USER_A, { title: 'y', position: 0 })
		expect(other.position).toBe(2)
	})

	it('list em position asc após PATCH de position', async () => {
		const a = await service.create(USER_A, { title: 'a' })
		const b = await service.create(USER_A, { title: 'b' })
		const c = await service.create(USER_A, { title: 'c' })
		await service.update(USER_A, c.id, { position: 0 })
		const list = await service.list(USER_A)
		expect(list.map((t) => t.id)).toEqual([c.id, a.id, b.id])
	})

	it('PATCH position reordena a lista', async () => {
		const a = await service.create(USER_A, { title: 'a' })
		const b = await service.create(USER_A, { title: 'b' })
		await service.update(USER_A, b.id, { position: 0 })
		const list = await service.list(USER_A)
		expect(list.map((t) => t.id)).toEqual([b.id, a.id])
		expect(list[0].position).toBe(0)
	})

	it('update rejeita position negativo (400)', async () => {
		const created = await service.create(USER_A, { title: 'x' })
		await expect(
			service.update(USER_A, created.id, { position: -1 }),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
	})

	it('update rejeita position não-inteiro (400)', async () => {
		const created = await service.create(USER_A, { title: 'x' })
		await expect(
			service.update(USER_A, created.id, { position: 1.5 }),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
		await expect(
			service.update(USER_A, created.id, {
				position: 'x' as unknown as number,
			}),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
	})

	it('reorder aplica nova ordem com positions 0,1,2', async () => {
		const a = await service.create(USER_A, { title: 'a' })
		const b = await service.create(USER_A, { title: 'b' })
		const c = await service.create(USER_A, { title: 'c' })
		const result = await service.reorder(USER_A, [c.id, a.id, b.id])
		expect(result.map((t) => t.id)).toEqual([c.id, a.id, b.id])
		expect(result.map((t) => t.position)).toEqual([0, 1, 2])
	})

	it('reorder parcial: não-listadas mantêm position', async () => {
		const a = await service.create(USER_A, { title: 'a' })
		const b = await service.create(USER_A, { title: 'b' })
		const c = await service.create(USER_A, { title: 'c' })
		await service.reorder(USER_A, [c.id, a.id])
		const kept = await service.getById(USER_A, b.id)
		expect(kept.position).toBe(2)
		const list = await service.list(USER_A)
		expect(list.map((t) => t.id)).toEqual([c.id, a.id, b.id])
	})

	it('reorder com id inexistente → 404 TASK_NOT_FOUND com missingIds', async () => {
		const a = await service.create(USER_A, { title: 'a' })
		await expect(service.reorder(USER_A, [a.id, 9999])).rejects.toMatchObject({
			statusCode: 404,
			code: 'TASK_NOT_FOUND',
			details: { missingIds: [9999] },
		})
	})

	it('reorder rejeita duplicado/vazio/<1/não-inteiro (400)', async () => {
		const a = await service.create(USER_A, { title: 'a' })
		const b = await service.create(USER_A, { title: 'b' })
		await expect(service.reorder(USER_A, [a.id, a.id])).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
		await expect(service.reorder(USER_A, [])).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
		await expect(service.reorder(USER_A, [0])).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
		await expect(service.reorder(USER_A, [-1])).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
		await expect(service.reorder(USER_A, [1.5])).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
		await expect(
			service.reorder(USER_A, ['x' as unknown as number]),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
		void b
	})

	it('reorder é atômico: falha não muta positions', async () => {
		const a = await service.create(USER_A, { title: 'a' })
		const b = await service.create(USER_A, { title: 'b' })
		await expect(service.reorder(USER_A, [b.id, 9999])).rejects.toMatchObject({
			code: 'TASK_NOT_FOUND',
		})
		expect((await service.getById(USER_A, a.id)).position).toBe(1)
		expect((await service.getById(USER_A, b.id)).position).toBe(2)
	})

	it('create persiste userId do dono', async () => {
		const task = await service.create(USER_A, { title: 'minha' })
		expect(task.userId).toBe(USER_A)
	})

	it('list é escopado: A não vê tarefas de B', async () => {
		await service.create(USER_A, { title: 'de-A' })
		await service.create(USER_B, { title: 'de-B' })
		const listA = await service.list(USER_A)
		const listB = await service.list(USER_B)
		expect(listA.map((t) => t.title)).toEqual(['de-A'])
		expect(listB.map((t) => t.title)).toEqual(['de-B'])
	})

	it('cross-user getById/update/remove → 404 TASK_NOT_FOUND', async () => {
		const owned = await service.create(USER_A, { title: 'secreta' })
		await expect(service.getById(USER_B, owned.id)).rejects.toMatchObject({
			statusCode: 404,
			code: 'TASK_NOT_FOUND',
		})
		await expect(
			service.update(USER_B, owned.id, { title: 'hack' }),
		).rejects.toMatchObject({
			statusCode: 404,
			code: 'TASK_NOT_FOUND',
		})
		await expect(service.remove(USER_B, owned.id)).rejects.toMatchObject({
			statusCode: 404,
			code: 'TASK_NOT_FOUND',
		})
		expect((await service.getById(USER_A, owned.id)).title).toBe('secreta')
	})

	it('position (max+1) é por dono', async () => {
		const a1 = await service.create(USER_A, { title: 'a1' })
		const b1 = await service.create(USER_B, { title: 'b1' })
		expect(a1.position).toBe(1)
		expect(b1.position).toBe(1)
		const a2 = await service.create(USER_A, { title: 'a2' })
		expect(a2.position).toBe(2)
	})

	it('reorder cross-user → 404 com missingIds', async () => {
		const owned = await service.create(USER_A, { title: 'a' })
		await service.create(USER_B, { title: 'b' })
		await expect(service.reorder(USER_B, [owned.id])).rejects.toMatchObject({
			statusCode: 404,
			code: 'TASK_NOT_FOUND',
			details: { missingIds: [owned.id] },
		})
	})

	it('create aceita limites exatos de tamanho (title 255, description 2000)', async () => {
		const task = await service.create(USER_A, {
			title: 'x'.repeat(255),
			description: 'd'.repeat(2000),
		})
		expect(task.title).toHaveLength(255)
		expect(task.description).toHaveLength(2000)
	})

	it('update rejeita patch null (400)', async () => {
		const created = await service.create(USER_A, { title: 'x' })
		await expect(
			service.update(USER_A, created.id, null as unknown as UpdateTaskInput),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('update/remove rejeitam id inválido e campos de tipo errado (400)', async () => {
		const created = await service.create(USER_A, { title: 'x' })
		await expect(
			service.update(USER_A, 0, { title: 'y' }),
		).rejects.toBeInstanceOf(ValidationError)
		await expect(service.remove(USER_A, 0)).rejects.toBeInstanceOf(
			ValidationError,
		)
		await expect(
			service.update(USER_A, created.id, {
				title: 123,
			} as unknown as UpdateTaskInput),
		).rejects.toBeInstanceOf(ValidationError)
		await expect(
			service.update(USER_A, created.id, {
				description: 123,
			} as unknown as UpdateTaskInput),
		).rejects.toBeInstanceOf(ValidationError)
		await expect(
			service.create(USER_A, {
				title: 123,
			} as unknown as CreateTaskInput),
		).rejects.toBeInstanceOf(ValidationError)
	})

	it('update: 404 vem da checagem de existência (repo.update não é chamado)', async () => {
		const updateSpy = vi.spyOn(repo, 'update')
		await expect(
			service.update(USER_A, 4242, { title: 'x' }),
		).rejects.toMatchObject({
			code: 'TASK_NOT_FOUND',
			message: 'Tarefa não encontrada',
		})
		expect(updateSpy).not.toHaveBeenCalled()
	})

	it('update: tarefa some entre findById e update → 404', async () => {
		const created = await service.create(USER_A, { title: 'x' })
		const updateSpy = vi.spyOn(repo, 'update').mockResolvedValue(null)
		await expect(
			service.update(USER_A, created.id, { title: 'y' }),
		).rejects.toMatchObject({
			code: 'TASK_NOT_FOUND',
			message: 'Tarefa não encontrada',
		})
		updateSpy.mockRestore()
	})

	it('reorder: validação de faltantes ocorre no service (updatePositions não é chamado)', async () => {
		const a = await service.create(USER_A, { title: 'a' })
		const positionsSpy = vi.spyOn(repo, 'updatePositions')
		await expect(service.reorder(USER_A, [a.id, 9999])).rejects.toMatchObject({
			code: 'TASK_NOT_FOUND',
			message: 'Tarefa não encontrada',
			details: { missingIds: [9999] },
		})
		expect(positionsSpy).not.toHaveBeenCalled()
	})

	it('reorder: service delega ao repo uma única vez com o array completo (sem loop por id)', async () => {
		const a = await service.create(USER_A, { title: 'a' })
		const b = await service.create(USER_A, { title: 'b' })
		const c = await service.create(USER_A, { title: 'c' })
		const positionsSpy = vi.spyOn(repo, 'updatePositions')
		const result = await service.reorder(USER_A, [c.id, a.id, b.id])
		expect(positionsSpy).toHaveBeenCalledTimes(1)
		expect(positionsSpy).toHaveBeenCalledWith([c.id, a.id, b.id], USER_A)
		expect(result.map((t) => t.id)).toEqual([c.id, a.id, b.id])
	})

	it('registra histórico de atividades nas operações', async () => {
		const activity = new RecordingActivityRepository()
		service = new TaskService(repo, activity)
		const created = await service.create(USER_A, { title: 't' })
		expect(activity.calls).toEqual([
			{ taskId: created.id, userId: USER_A, action: 'created' },
		])
		await service.update(USER_A, created.id, { completed: true })
		await service.update(USER_A, created.id, { title: 'novo' })
		await service.update(USER_A, created.id, { position: 0 })
		await service.update(USER_A, created.id, { title: 'x2', position: 1 })
		await service.update(USER_A, created.id, { completed: false })
		await service.remove(USER_A, created.id)
		expect(activity.calls.map((c) => c.action)).toEqual([
			'created',
			'completed',
			'updated',
			'updated',
			'uncompleted',
			'deleted',
		])
		expect(activity.calls).toHaveLength(6)
		expect(activity.calls.at(-1)).toEqual({
			taskId: created.id,
			userId: USER_A,
			action: 'deleted',
		})
	})

	it('update só registra completed/uncompleted quando completed muda; position-only não registra', async () => {
		const activity = new RecordingActivityRepository()
		service = new TaskService(repo, activity)
		const created = await service.create(USER_A, { title: 't' })
		await service.update(USER_A, created.id, { completed: false })
		expect(activity.calls.map((c) => c.action)).toEqual(['created', 'updated'])
		await service.update(USER_A, created.id, { position: 0 })
		expect(activity.calls).toHaveLength(2)
		await service.update(USER_A, created.id, { title: 'x', position: 1 })
		expect(activity.calls.map((c) => c.action)).toEqual([
			'created',
			'updated',
			'updated',
		])
	})

	it('falha no histórico não derruba a operação (degradado)', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const activity = new RecordingActivityRepository()
		activity.failOnce = true
		service = new TaskService(repo, activity)
		const created = await service.create(USER_A, { title: 't' })
		expect(created.title).toBe('t')
		await vi.waitFor(() => {
			expect(warn).toHaveBeenCalledTimes(1)
		})
		expect(warn.mock.calls[0][0]).toBe(
			'[task-service] histórico de atividades degradado:',
		)
		warn.mockRestore()
	})

	it('record fire-and-forget: create resolve mesmo com record nunca resolvido', async () => {
		let resolveRecord!: (value: ActivityLogEntity) => void
		const pending = new Promise<ActivityLogEntity>((resolve) => {
			resolveRecord = resolve
		})
		const activity: IActivityRepository = {
			record: vi.fn(() => pending),
			findByTask: async () => [],
			findByUser: async () => [],
		}
		service = new TaskService(repo, activity)
		await expect(
			service.create(USER_A, { title: 'não-espera' }),
		).resolves.toMatchObject({ title: 'não-espera' })
		resolveRecord({
			taskId: 1,
			action: 'created',
		} as unknown as ActivityLogEntity)
	})

	it('record fire-and-forget: rejeição tardia não derruba a operação e warna com prefixo', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const activity: IActivityRepository = {
			record: () =>
				new Promise<ActivityLogEntity>((_resolve, reject) => {
					setTimeout(() => reject(new Error('mongo caiu')), 0)
				}),
			findByTask: async () => [],
			findByUser: async () => [],
		}
		service = new TaskService(repo, activity)
		const created = await service.create(USER_A, { title: 't' })
		expect(created.title).toBe('t')
		await vi.waitFor(() => {
			expect(warn).toHaveBeenCalledTimes(1)
		})
		expect(warn.mock.calls[0][0]).toBe(
			'[task-service] histórico de atividades degradado:',
		)
		warn.mockRestore()
	})

	it('sem activity repository não há warning nem erro', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const created = await service.create(USER_A, { title: 't' })
		await service.remove(USER_A, created.id)
		expect(warn).not.toHaveBeenCalled()
		warn.mockRestore()
	})
})

interface FakeQueryCall {
	kind: 'SELECT' | 'UPDATE'
	sql: string
	params: unknown[]
}

function ownedIdsFrom(where: Record<string, unknown> | undefined): number[] {
	if (where === undefined) {
		return []
	}
	const raw = where.id
	if (raw instanceof FindOperator) {
		return raw.value as number[]
	}
	return [raw as number]
}

function matchesWhere(
	row: TaskEntity,
	where: Record<string, unknown> | undefined,
): boolean {
	if (where === undefined) {
		return true
	}
	if (!ownedIdsFrom(where).includes(row.id)) {
		return false
	}
	if ('userId' in where && where.userId !== row.userId) {
		return false
	}
	return true
}

// simula o efeito do UPDATE batch CASE WHEN: params = [id, pos, …, (userId?), ids]
function applyFakeUpdate(
	rows: TaskEntity[],
	sql: string,
	params: unknown[],
): void {
	const withUserScope = sql.includes('`userId`')
	const pairCount = withUserScope ? (params.length - 1) / 3 : params.length / 3
	for (let index = 0; index < pairCount; index++) {
		const id = params[index * 2] as number
		const position = params[index * 2 + 1] as number
		const row = rows.find((r) => r.id === id)
		if (row !== undefined) {
			row.position = position
		}
	}
}

function makeEntity(id: number, userId: number, position: number): TaskEntity {
	return {
		id,
		title: `tarefa-${id}`,
		description: null,
		completed: false,
		position,
		userId,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as TaskEntity
}

class CountingFakeManager {
	constructor(private readonly ds: CountingFakeDataSource) {}

	getRepository(_target?: unknown) {
		return {
			find: async (options: {
				where?: Record<string, unknown>
			}): Promise<TaskEntity[]> => {
				this.ds.calls.push({ kind: 'SELECT', sql: 'find', params: [] })
				return this.ds.rows.filter((row) => matchesWhere(row, options?.where))
			},
		}
	}

	async query(sql: string, params?: unknown[]): Promise<unknown> {
		const call: FakeQueryCall = { kind: 'UPDATE', sql, params: params ?? [] }
		this.ds.calls.push(call)
		applyFakeUpdate(this.ds.rows, call.sql, call.params)
		return []
	}
}

class CountingFakeDataSource {
	readonly calls: FakeQueryCall[] = []
	rows: TaskEntity[] = []

	getRepository(_target?: unknown) {
		return {}
	}

	async transaction<T>(
		run: (manager: CountingFakeManager) => Promise<T>,
	): Promise<T> {
		return run(new CountingFakeManager(this))
	}
}

describe('TypeOrmTaskRepository.updatePositions (unit, fake DataSource)', () => {
	let ds: CountingFakeDataSource
	let repo: TypeOrmTaskRepository

	beforeEach(() => {
		ds = new CountingFakeDataSource()
		repo = new TypeOrmTaskRepository(ds as unknown as DataSource)
	})

	it('N=3: exatamente 3 queries [SELECT, UPDATE, SELECT] e retorno na ordem do payload', async () => {
		ds.rows = [makeEntity(1, 1, 2), makeEntity(2, 1, 0), makeEntity(3, 1, 1)]
		const result = await repo.updatePositions([3, 1, 2])
		expect(ds.calls.map((c) => c.kind)).toEqual(['SELECT', 'UPDATE', 'SELECT'])
		expect(result.map((t) => t.id)).toEqual([3, 1, 2])
		expect(result.map((t) => t.position)).toEqual([0, 1, 2])
	})

	it('N=50: ainda são 3 queries (sem N+1)', async () => {
		ds.rows = Array.from({ length: 50 }, (_, index) =>
			makeEntity(index + 1, 1, index),
		)
		const orderedIds = Array.from({ length: 50 }, (_, index) => 50 - index)
		const result = await repo.updatePositions(orderedIds)
		expect(ds.calls).toHaveLength(3)
		expect(result.map((t) => t.id)).toEqual(orderedIds)
	})

	it('UPDATE batch CASE WHEN 100% parametrizado: 2N+N params (+1 com userId)', async () => {
		const a = makeEntity(7, 5, 0)
		const b = makeEntity(8, 5, 1)
		const c = makeEntity(9, 5, 2)
		ds.rows = [a, b, c]
		await repo.updatePositions([c.id, a.id, b.id], 5)
		const call = ds.calls.find(
			(entry) => entry.kind === 'UPDATE',
		) as FakeQueryCall
		expect(call.sql).toContain('CASE `id`')
		expect(call.sql).toContain('IN (')
		expect(call.params).toHaveLength(2 * 3 + 3 + 1)
		expect(call.params.slice(0, 6)).toEqual([9, 0, 7, 1, 8, 2])
		expect(call.params).toContain(5)
		await repo.updatePositions([c.id, a.id, b.id])
		const callSemUser = ds.calls
			.filter((entry) => entry.kind === 'UPDATE')
			.at(-1) as FakeQueryCall
		expect(callSemUser.params).toHaveLength(2 * 3 + 3)
	})

	it('id faltante → NotFoundError com TODOS os missingIds e NENHUM UPDATE (atomicidade)', async () => {
		ds.rows = [makeEntity(1, 1, 0), makeEntity(2, 1, 1)]
		await expect(repo.updatePositions([1, 300, 400])).rejects.toMatchObject({
			statusCode: 404,
			code: 'TASK_NOT_FOUND',
			details: { missingIds: [300, 400] },
		})
		expect(ds.calls.filter((entry) => entry.kind === 'UPDATE')).toHaveLength(0)
	})

	it('userId escopo: id de outro usuário vai para missingIds', async () => {
		ds.rows = [makeEntity(1, 1, 0), makeEntity(2, 2, 1)]
		await expect(repo.updatePositions([1, 2], 1)).rejects.toMatchObject({
			code: 'TASK_NOT_FOUND',
			details: { missingIds: [2] },
		})
		expect(ds.calls.filter((entry) => entry.kind === 'UPDATE')).toHaveLength(0)
	})
})
