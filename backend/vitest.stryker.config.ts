import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		pool: 'forks',
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},
		testTimeout: 30_000,
		hookTimeout: 30_000,
		include: ['test/unit/**/*.spec.ts'],
	},
})
