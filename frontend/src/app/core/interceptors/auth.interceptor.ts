import type { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http'
import { inject } from '@angular/core'
import { Router } from '@angular/router'
import { catchError, throwError } from 'rxjs'
import { TokenService } from '../services/token.service'

const AUTH_URL_MARKER = '/api/auth'

function isApiUrl(url: string): boolean {
	return url.startsWith('/api/')
}

function isAuthUrl(url: string): boolean {
	return url.includes(AUTH_URL_MARKER)
}

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
			if (err.status === 401 && api && !auth) {
				tokens.clear()
				void router.navigate(['/auth/login'])
			}
			return throwError(() => err)
		}),
	)
}
