// worker-backend/test/index.spec.ts
import { describe, it, expect } from 'vitest';
import worker from '../src/index';
import type { D1Database } from '@cloudflare/workers-types';

// Create mock environment
const mockEnv = {
  MY_DB: {
    prepare: () => {},
    exec: () => Promise.resolve({ results: [] })
  } as unknown as D1Database,
  GOOGLE_MAPS_API_KEY: 'test_key',
  STRIPE_SECRET_KEY: 'test_key',
  STRIPE_WEBHOOK_SECRET: 'test_webhook_secret'
};

describe('Worker test', () => {
  it('should handle requests', async () => {
    const request = new Request('http://example.com');
    const response = await worker.fetch(request, mockEnv);
    expect(response).toBeDefined();
  });
});