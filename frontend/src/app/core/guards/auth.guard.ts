import { inject } from '@angular/core'
import { type CanActivateFn, Router } from '@angular/router'
import { TokenService } from '../services/token.service'

export const authGuard: CanActivateFn = () => {
	const tokens = inject(TokenService)
	const router = inject(Router)
	if (tokens.getToken() !== null) return true
	return router.createUrlTree(['/auth/login'])
}
