import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendTestSpan } from '../validate.js';

describe('sendTestSpan', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    expect(await sendTestSpan('test-key')).toBe(true);
  });

  it('returns true on 404 (auth OK, sim not found)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    expect(await sendTestSpan('test-key')).toBe(true);
  });

  it('returns false on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    expect(await sendTestSpan('test-key')).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    expect(await sendTestSpan('test-key')).toBe(false);
  });

  it('sends correct headers', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(''));
    await sendTestSpan('my-key');

    const [, init] = mockFetch.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('my-key');
    expect(headers['X-Simulation-Id']).toBe('wizard-test');
    expect(headers['Content-Type']).toBe('application/json');
  });
});
