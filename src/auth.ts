import * as p from '@clack/prompts'
import {
  AUTH_TIMEOUT_MS,
  COVAL_AGENTS_ENDPOINT,
  COVAL_API_KEY_ENV,
  VERIFY_RESULTS,
} from './constants.js'

/** Resolve the Coval API key from env or interactive prompt. */
export const getApiKey = async (): Promise<string> => {
  const envKey = process.env[COVAL_API_KEY_ENV]
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

/** Verify an API key. Distinguishes auth failures (401/403) from network/server issues. */
export const verifyApiKey = async (apiKey: string): Promise<VerifyResult> => {
  try {
    const res = await fetch(COVAL_AGENTS_ENDPOINT, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    })
    if (res.ok) return VERIFY_RESULTS.OK
    if (res.status === 401 || res.status === 403) return VERIFY_RESULTS.INVALID
    return VERIFY_RESULTS.NETWORK_ERROR
  } catch {
    return VERIFY_RESULTS.NETWORK_ERROR
  }
}
