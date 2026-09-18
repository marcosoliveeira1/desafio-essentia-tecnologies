import type { Routes } from '@angular/router'

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'tasks' },
	{
		loadChildren: () =>
			import('./features/tasks/tasks.routes').then((m) => m.tasksRoutes),
		path: 'tasks',
	},
]
