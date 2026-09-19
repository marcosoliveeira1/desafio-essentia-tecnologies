import { TestBed } from '@angular/core/testing'
import {
	type ActivatedRouteSnapshot,
	provideRouter,
	type RedirectCommand,
	Router,
	type RouterStateSnapshot,
	type UrlTree,
} from '@angular/router'
import { beforeEach, describe, expect, it } from 'vitest'
import { TokenService } from '../services/token.service'
import { authGuard } from './auth.guard'

function encodePayload(payload: unknown): string {
	return btoa(JSON.stringify(payload))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}

function fakeJwt(payload: Record<string, unknown>): string {
	return `${encodePayload({ alg: 'HS256', typ: 'JWT' })}.${encodePayload(payload)}.assinatura`
}

function sessionJwt(exp: number): string {
	return fakeJwt({
		sub: 42,
		name: 'Ada',
		email: 'ada@essentia.com',
		exp,
	})
}

describe('authGuard', () => {
	let tokens: TokenService
	let router: Router

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideRouter([])],
		})
		tokens = TestBed.inject(TokenService)
		router = TestBed.inject(Router)
		localStorage.clear()
	})

	function runGuard(): boolean | UrlTree | RedirectCommand {
		const route = {} as ActivatedRouteSnapshot
		const state = { url: '/tasks' } as RouterStateSnapshot
		return TestBed.runInInjectionContext(() => authGuard(route, state)) as
			| boolean
			| UrlTree
			| RedirectCommand
	}

	function loginUrl(): string {
		return router.serializeUrl(router.createUrlTree(['/auth/login']))
	}

	function assertRedirectsToLogin(
		result: boolean | UrlTree | RedirectCommand,
	): void {
		expect(router.serializeUrl(result as UrlTree)).toBe(loginUrl())
	}

	it('token ausente redireciona para /auth/login', () => {
		assertRedirectsToLogin(runGuard())
	})

	it('token com exp válida passa', () => {
		tokens.setToken(sessionJwt(Math.floor(Date.now() / 1000) + 3600))

		expect(runGuard()).toBe(true)
		expect(tokens.getToken()).not.toBeNull()
	})

	it('token expirado limpa o token e redireciona para /auth/login', () => {
		tokens.setToken(sessionJwt(Math.floor(Date.now() / 1000) - 10))

		const result = runGuard()

		expect(tokens.getToken()).toBeNull()
		assertRedirectsToLogin(result)
	})

	it('token sem exp é tratado como sessão inválida (limpa e redireciona)', () => {
		tokens.setToken(
			fakeJwt({ sub: 42, name: 'Ada', email: 'ada@essentia.com' }),
		)

		const result = runGuard()

		expect(tokens.getToken()).toBeNull()
		assertRedirectsToLogin(result)
	})

	it('token malformado limpa o token e redireciona', () => {
		tokens.setToken('nao-e-um-jwt')

		const result = runGuard()

		expect(tokens.getToken()).toBeNull()
		assertRedirectsToLogin(result)
	})
})
