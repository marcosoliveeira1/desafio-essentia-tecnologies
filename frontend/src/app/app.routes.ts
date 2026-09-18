import type { Routes } from '@angular/router'
import { authGuard } from './core/guards/auth.guard'

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'tasks' },
	{
		loadChildren: () =>
			import('./features/auth/auth.routes').then((m) => m.authRoutes),
		path: 'auth',
	},
	{
		canActivate: [authGuard],
		loadChildren: () =>
			import('./features/tasks/tasks.routes').then((m) => m.tasksRoutes),
		path: 'tasks',
	},
]
