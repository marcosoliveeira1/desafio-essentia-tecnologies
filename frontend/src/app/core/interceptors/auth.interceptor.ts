import {
	type HttpErrorResponse,
	type HttpInterceptorFn,
} from '@angular/common/http'
import { inject } from '@angular/core'
import { Router } from '@angular/router'
import { catchError, throwError } from 'rxjs'
import { TokenService } from '../services/token.service'

const AUTH_URL_MARKER = '/api/auth'

function isApiUrl(url: string): boolean {
	return url.includes('/api/')
}

function isAuthUrl(url: string): boolean {
	return url.includes(AUTH_URL_MARKER)
}

// NUNCA injetar AuthStore aqui: o store usa HttpClient, que passa por este
// interceptor — injetá-lo criaria dependência circular (DI cycle).
// Só TokenService (localStorage puro) + Router.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
	const tokens = inject(TokenService)
	const router = inject(Router)

	const api = isApiUrl(req.url)
	const auth = isAuthUrl(req.url)

	let request = req
	if (api && !auth) {
		const token = tokens.getToken()
		if (token !== null) {
			request = req.clone({
				setHeaders: { Authorization: `Bearer ${token}` },
			})
		}
	}

	return next(request).pipe(
		catchError((err: HttpErrorResponse) => {
			// 401 em rota protegida = sessão inválida/expirada: limpa e volta
			// ao login. 401 em /api/auth/* (ex.: login com senha errada) NÃO
			// limpa nem navega — senão o próprio login entraria em loop.
			if (err.status === 401 && api && !auth) {
				tokens.clear()
				// No-op seguro até T20 criar a rota: navigate p/ rota
				// inexistente só resolve `false`, sem throw.
				void router.navigate(['/auth/login'])
			}
			return throwError(() => err)
		}),
	)
}
