import { inject } from '@angular/core'
import { type CanActivateFn, Router } from '@angular/router'
import { TokenService } from '../services/token.service'

// DECISÃO TRAVADA T20: guard síncrono via `tokenService.getToken() !== null`,
// sem hidratação de store (sem mudar T19). Após login/register o token já está
// no localStorage, então o redirect pós-auth funciona sem estado extra.
export const authGuard: CanActivateFn = () => {
	const tokens = inject(TokenService)
	const router = inject(Router)
	if (tokens.getToken() !== null) return true
	return router.createUrlTree(['/auth/login'])
}
