import { inject } from '@angular/core'
import { type CanActivateFn, Router } from '@angular/router'
import { TokenService } from '../services/token.service'
import { decodeJwtPayload, isJwtExpired } from '../utils/jwt'

export const authGuard: CanActivateFn = () => {
	const tokens = inject(TokenService)
	const router = inject(Router)
	const token = tokens.getToken()
	if (token !== null) {
		const payload = decodeJwtPayload(token)
		if (payload !== null && !isJwtExpired(payload)) return true
	}
	tokens.clear()
	return router.createUrlTree(['/auth/login'])
}
