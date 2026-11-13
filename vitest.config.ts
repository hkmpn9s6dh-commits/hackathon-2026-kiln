import { defineConfig } from 'vitest/config';

// This machine has bitten us before: several workers sharing one temp file
// makes vitest exit 0 while silently skipping a file. One fork, no parallelism.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
