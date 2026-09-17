import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // e2e compartilha o MySQL de teste — rodar sequencial (ver tasks.md)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
