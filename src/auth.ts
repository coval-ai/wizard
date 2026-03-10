import * as p from '@clack/prompts'
import { COVAL_AGENTS_ENDPOINT, VERIFY_RESULTS } from './constants.js'

/** Resolve the Coval API key from env or interactive prompt. */
export const getApiKey = async (): Promise<string> => {
  const envKey = process.env.COVAL_API_KEY
  if (envKey) return envKey

  const result = await p.password({
    message: 'Enter your Coval API key',
    validate: (v) => {
      if (!v) return 'API key is required'
    },
  })

  if (p.isCancel(result)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  return result
}

export type VerifyResult = (typeof VERIFY_RESULTS)[keyof typeof VERIFY_RESULTS]

/** Verify an API key. Distinguishes auth failure from network issues. */
export const verifyApiKey = async (apiKey: string): Promise<VerifyResult> => {
  try {
    const res = await fetch(COVAL_AGENTS_ENDPOINT, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(10_000),
    })
    return res.ok ? VERIFY_RESULTS.OK : VERIFY_RESULTS.INVALID
  } catch {
    return VERIFY_RESULTS.NETWORK_ERROR
  }
}
