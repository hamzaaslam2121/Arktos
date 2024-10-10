import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['worker-backend/test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  }
});