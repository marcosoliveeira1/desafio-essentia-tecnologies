import type { Routes } from '@angular/router'

export const authRoutes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{
		loadComponent: () =>
			import('./pages/login-page/login-page').then((m) => m.LoginPage),
		path: 'login',
	},
	{
		loadComponent: () =>
			import('./pages/register-page/register-page').then((m) => m.RegisterPage),
		path: 'register',
	},
]
