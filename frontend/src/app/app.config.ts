import { registerLocaleData } from '@angular/common'
import localePt from '@angular/common/locales/pt'
import { provideHttpClient, withInterceptors } from '@angular/common/http'
import {
	type ApplicationConfig,
	LOCALE_ID,
	provideBrowserGlobalErrorListeners,
} from '@angular/core'
import { provideRouter } from '@angular/router'
import { authInterceptor } from './core/interceptors/auth.interceptor'
import { routes } from './app.routes'

registerLocaleData(localePt)

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideHttpClient(withInterceptors([authInterceptor])),
		provideRouter(routes),
		{ provide: LOCALE_ID, useValue: 'pt-BR' },
	],
}
