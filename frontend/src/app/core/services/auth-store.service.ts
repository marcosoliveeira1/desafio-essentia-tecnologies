import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import { computed, Injectable, inject, signal } from '@angular/core'
import { switchMap } from 'rxjs'
import type {
	AuthResponse,
	AuthState,
	LoginDto,
	RegisterDto,
	User,
} from '../models/auth.model'
import { decodeJwtPayload, isJwtExpired } from '../utils/jwt'
import { TokenService } from './token.service'

const MSG_LOGIN_UNAUTHORIZED = 'Email ou senha inválidos.'
const MSG_LOGIN_FALLBACK = 'Não foi possível entrar. Tente novamente.'
const MSG_REGISTER_CONFLICT = 'Email já cadastrado.'
const MSG_REGISTER_FALLBACK = 'Não foi possível criar a conta. Tente novamente.'
const MSG_BAD_REQUEST = 'Verifique os dados e tente novamente.'
const MSG_BAD_EMAIL = 'E-mail inválido. Corrija e tente novamente.'

interface RegisterResponse {
	id: number
	name: string
	email: string
}

function subFromToken(token: string): number | null {
	const payload = decodeJwtPayload(token)
	if (payload === null) return null
	const sub =
		typeof payload.sub === 'string' ? Number(payload.sub) : payload.sub
	return typeof sub === 'number' && Number.isInteger(sub) && sub > 0
		? sub
		: null
}

function userFromToken(token: string): User | null {
	const payload = decodeJwtPayload(token)
	if (payload === null || isJwtExpired(payload)) return null
	if (typeof payload.name !== 'string' || typeof payload.email !== 'string') {
		return null
	}
	const id = subFromToken(token)
	if (id === null) return null
	return { id, name: payload.name, email: payload.email }
}

function displayNameFromEmail(email: string): string {
	const local = email.split('@')[0]
	return local && local.length > 0 ? local : email
}

function errorCode(err: unknown): string | null {
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

function hasEmailDetail(err: unknown): boolean {
	if (!(err instanceof HttpErrorResponse)) return false
	const body = err.error as { details?: unknown } | null
	if (
		body === null ||
		typeof body !== 'object' ||
		!Array.isArray(body.details)
	) {
		return false
	}
	return body.details.some(
		(d) =>
			d !== null &&
			typeof d === 'object' &&
			'field' in d &&
			(d as { field?: unknown }).field === 'email',
	)
}

function loginErrorMessage(err: unknown): string {
	if (err instanceof HttpErrorResponse) {
		if (err.status === 401) return MSG_LOGIN_UNAUTHORIZED
		if (err.status === 400)
			return hasEmailDetail(err) ? MSG_BAD_EMAIL : MSG_BAD_REQUEST
	}
	return MSG_LOGIN_FALLBACK
}

function registerErrorMessage(err: unknown): string {
	if (err instanceof HttpErrorResponse) {
		if (err.status === 409 || errorCode(err) === 'EMAIL_CONFLICT') {
			return MSG_REGISTER_CONFLICT
		}
		if (err.status === 400)
			return hasEmailDetail(err) ? MSG_BAD_EMAIL : MSG_BAD_REQUEST
	}
	return MSG_REGISTER_FALLBACK
}

@Injectable({ providedIn: 'root' })
export class AuthStoreService {
	private readonly http = inject(HttpClient)
	private readonly tokens = inject(TokenService)

	readonly user = signal<User | null>(this.hydratedUser())
	readonly loading = signal(false)
	readonly error = signal<string | null>(null)
	readonly authState = computed<AuthState>(() =>
		this.user() !== null ? 'authenticated' : 'anonymous',
	)

	private hydratedUser(): User | null {
		const token = this.tokens.getToken()
		if (token === null) return null
		const user = userFromToken(token)
		if (user === null) this.tokens.clear()
		return user
	}

	login(dto: LoginDto): void {
		this.loading.set(true)
		this.error.set(null)
		this.http.post<AuthResponse>('/api/auth/login', dto).subscribe({
			error: (err: unknown) => {
				this.error.set(loginErrorMessage(err))
				this.loading.set(false)
			},
			next: ({ token }) => {
				const id = subFromToken(token)
				if (id === null) {
					this.logout()
					this.error.set(MSG_LOGIN_FALLBACK)
					this.loading.set(false)
					return
				}
				this.tokens.setToken(token)
				this.user.set({
					email: dto.email,
					id,
					name: displayNameFromEmail(dto.email),
				})
				this.error.set(null)
				this.loading.set(false)
			},
		})
	}

	register(dto: RegisterDto): void {
		this.loading.set(true)
		this.error.set(null)
		this.http
			.post<RegisterResponse>('/api/auth/register', dto)
			.pipe(
				switchMap(() =>
					this.http.post<AuthResponse>('/api/auth/login', {
						email: dto.email,
						password: dto.password,
					}),
				),
			)
			.subscribe({
				error: (err: unknown) => {
					this.error.set(registerErrorMessage(err))
					this.loading.set(false)
				},
				next: ({ token }) => {
					const id = subFromToken(token)
					if (id === null) {
						this.logout()
						this.error.set(MSG_REGISTER_FALLBACK)
						this.loading.set(false)
						return
					}
					this.tokens.setToken(token)
					this.user.set({
						email: dto.email,
						id,
						name: dto.name,
					})
					this.error.set(null)
					this.loading.set(false)
				},
			})
	}

	logout(): void {
		this.tokens.clear()
		this.user.set(null)
		this.error.set(null)
	}
}
