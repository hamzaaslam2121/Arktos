import { describe, it, expect, vi } from 'vitest';

// Mock the global scope to simulate Cloudflare Workers environment
const mockAddEventListener = vi.fn();
const mockFetch = vi.fn();
(global as any).addEventListener = mockAddEventListener;
(global as any).fetch = mockFetch;

// Import the worker script
import '../src/index';

// Extract the event listener callback
const getEventListener = () => {
  const call = mockAddEventListener.mock.calls.find(call => call[0] === 'fetch');
  return call ? call[1] : null;
};

describe('Cloudflare Worker', () => {
  it('handles API requests', async () => {
    const listener = getEventListener();
    expect(listener).toBeTruthy();

    const request = new Request('http://example.com/api/hello');
    const respondWithMock = vi.fn();
    const event = { request, respondWith: respondWithMock };

    listener(event);

    const response = await respondWithMock.mock.calls[0][0];
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    
    const body = await response.json();
    expect(body).toEqual({ message: 'Hello from Cloudflare Worker!' });
  });

  it('handles non-API requests', async () => {
    const listener = getEventListener();
    expect(listener).toBeTruthy();

    const request = new Request('http://example.com');
    const respondWithMock = vi.fn();
    const event = { request, respondWith: respondWithMock };
    
    // Mock the global fetch function
    mockFetch.mockResolvedValue(new Response('Mocked response'));

    listener(event);

    const response = await respondWithMock.mock.calls[0][0];
    
    expect(mockFetch).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe('Mocked response');
  });

  it('handles 404 for unknown API routes', async () => {
    const listener = getEventListener();
    expect(listener).toBeTruthy();

    const request = new Request('http://example.com/api/unknown');
    const respondWithMock = vi.fn();
    const event = { request, respondWith: respondWithMock };

    listener(event);

    const response = await respondWithMock.mock.calls[0][0];
    
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not Found');
  });
});