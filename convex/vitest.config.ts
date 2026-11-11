// The Convex tests run in Vitest, not in `bun test`: convex-test needs the edge runtime Convex functions run in.
//   bunx vitest run --root convex
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    include: ['**/*.test.ts'],
    server: { deps: { inline: ['convex-test'] } },
  },
});
