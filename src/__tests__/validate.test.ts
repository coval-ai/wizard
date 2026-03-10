import { jest } from '@jest/globals'
import { sendTestSpan } from '../validate.js'

describe('sendTestSpan', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('returns true on 200', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }))
    expect(await sendTestSpan('test-key')).toBe(true)
  })

  it('returns true on 404 (auth OK, sim not found)', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    expect(await sendTestSpan('test-key')).toBe(true)
  })

  it('returns false on 401', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }))
    expect(await sendTestSpan('test-key')).toBe(false)
  })

  it('returns false on network error', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
    expect(await sendTestSpan('test-key')).toBe(false)
  })

  it('sends correct headers', async () => {
    const mockFetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(''))
    await sendTestSpan('my-key')

    const [, init] = mockFetch.mock.calls[0]
    const headers = init?.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('my-key')
    expect(headers['X-Simulation-Id']).toBe('wizard-test')
    expect(headers['Content-Type']).toBe('application/json')
  })
})
