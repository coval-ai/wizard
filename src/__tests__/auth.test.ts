import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyApiKey } from '../auth.js';

describe('verifyApiKey', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    expect(await verifyApiKey('valid-key')).toBe(true);
  });

  it('returns false on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    expect(await verifyApiKey('bad-key')).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'));
    expect(await verifyApiKey('any-key')).toBe(false);
  });
});
