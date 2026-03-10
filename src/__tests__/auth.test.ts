import { jest } from '@jest/globals';
import { verifyApiKey } from '../auth.js';

describe('verifyApiKey', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('returns ok on 200', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    expect(await verifyApiKey('valid-key')).toBe('ok');
  });

  it('returns invalid on 401', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    expect(await verifyApiKey('bad-key')).toBe('invalid');
  });

  it('returns network_error on fetch failure', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'));
    expect(await verifyApiKey('any-key')).toBe('network_error');
  });
});
