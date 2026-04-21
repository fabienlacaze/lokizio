import { defineConfig } from 'vitest/config';

// Separate config for integration tests: real Supabase project, slower, sequential.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.js'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Serial execution to avoid rate limits on free Supabase project
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
