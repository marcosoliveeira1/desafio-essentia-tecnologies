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
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: [
				'src/main.ts',
				'src/seed.ts',
				'src/container.ts',
				'src/database/migrations/**',
				'src/**/*.data-source.ts',
			],
			thresholds: { lines: 80, statements: 80, branches: 70 },
		},
	},
})
