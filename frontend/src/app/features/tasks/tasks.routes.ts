import type { Routes } from '@angular/router'

export const tasksRoutes: Routes = [
	{
		loadComponent: () =>
			import('./pages/task-list-page/task-list-page').then(
				(m) => m.TaskListPage,
			),
		path: '',
	},
]
