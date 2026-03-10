import * as p from '@clack/prompts';
import { COVAL_AGENTS_ENDPOINT } from './constants.js';

/** Resolve the Coval API key from env or interactive prompt. */
export async function getApiKey(): Promise<string> {
  const envKey = process.env.COVAL_API_KEY;
  if (envKey) return envKey;

  const result = await p.password({
    message: 'Enter your Coval API key',
    validate: (v) => {
      if (!v) return 'API key is required';
    },
  });

  if (p.isCancel(result)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  return result;
}

export type VerifyResult = 'ok' | 'invalid' | 'network_error';

/** Verify an API key. Distinguishes auth failure from network issues. */
export async function verifyApiKey(apiKey: string): Promise<VerifyResult> {
  try {
    const res = await fetch(COVAL_AGENTS_ENDPOINT, {
      headers: { 'x-api-key': apiKey },
    });
    return res.ok ? 'ok' : 'invalid';
  } catch {
    return 'network_error';
  }
}
