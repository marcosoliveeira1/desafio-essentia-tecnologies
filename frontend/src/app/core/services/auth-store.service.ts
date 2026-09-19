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
import { TokenService } from './token.service'

const MSG_LOGIN_UNAUTHORIZED = 'Email ou senha inválidos.'
const MSG_LOGIN_FALLBACK = 'Não foi possível entrar. Tente novamente.'
const MSG_REGISTER_CONFLICT = 'Email já cadastrado.'
const MSG_REGISTER_FALLBACK = 'Não foi possível criar a conta. Tente novamente.'
const MSG_BAD_REQUEST = 'Verifique os dados e tente novamente.'

interface RegisterResponse {
	id: number
	name: string
	email: string
}

function userIdFromToken(token: string): number | null {
	try {
		const payload = token.split('.')[1]
		if (!payload) return null
		const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
		const binary = atob(base64)
		const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
		const json = new TextDecoder().decode(bytes)
		const decoded = JSON.parse(json) as { sub?: unknown }
		const sub =
			typeof decoded.sub === 'string' ? Number(decoded.sub) : decoded.sub
		return typeof sub === 'number' && Number.isFinite(sub) ? sub : null
	} catch {
		return null
	}
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

function loginErrorMessage(err: unknown): string {
	if (err instanceof HttpErrorResponse) {
		if (err.status === 401) return MSG_LOGIN_UNAUTHORIZED
		if (err.status === 400) return MSG_BAD_REQUEST
	}
	return MSG_LOGIN_FALLBACK
}

function registerErrorMessage(err: unknown): string {
	if (err instanceof HttpErrorResponse) {
		if (err.status === 409 || errorCode(err) === 'EMAIL_CONFLICT') {
			return MSG_REGISTER_CONFLICT
		}
		if (err.status === 400) return MSG_BAD_REQUEST
	}
	return MSG_REGISTER_FALLBACK
}

@Injectable({ providedIn: 'root' })
export class AuthStoreService {
	private readonly http = inject(HttpClient)
	private readonly tokens = inject(TokenService)

	readonly user = signal<User | null>(null)
	readonly loading = signal(false)
	readonly error = signal<string | null>(null)
	readonly authState = computed<AuthState>(() =>
		this.user() !== null ? 'authenticated' : 'anonymous',
	)

	login(dto: LoginDto): void {
		this.loading.set(true)
		this.error.set(null)
		this.http.post<AuthResponse>('/api/auth/login', dto).subscribe({
			error: (err: unknown) => {
				this.error.set(loginErrorMessage(err))
				this.loading.set(false)
			},
			next: ({ token }) => {
				this.tokens.setToken(token)
				this.user.set({
					email: dto.email,
					id: userIdFromToken(token) ?? 0,
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
					this.tokens.setToken(token)
					this.user.set({
						email: dto.email,
						id: userIdFromToken(token) ?? 0,
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
