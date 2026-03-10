import * as p from '@clack/prompts'
import {
  ABORT_ERROR_NAME,
  ANTHROPIC_API_VERSION,
  CONTENT_TYPE_JSON,
  FRAMEWORKS,
  LLM_DEFAULTS,
  LLM_MAX_TOKENS,
  LLM_PROVIDERS,
  LLM_ROLES,
  LLM_TIMEOUT_MS,
  type Framework,
  type LLMProvider,
} from './constants.js'
import { buildSystemPrompt, buildUserPrompt } from './prompts.js'
import type { WizardLLMResponse } from './types.js'

export type LLMConfig = {
  key: string
  provider: LLMProvider
  model: string
  endpoint: string
}

/**
 * Resolve LLM configuration — from env vars if set, otherwise prompt interactively.
 *
 * Env vars (skip the prompt):
 * - `WIZARD_LLM_KEY`      — API key for the LLM provider
 * - `WIZARD_LLM_PROVIDER` — `anthropic` | `openai` | `gemini` (default: `anthropic`)
 * - `WIZARD_LLM_MODEL`    — override the default model for the provider
 */
export const getLLMConfig = async (): Promise<LLMConfig> => {
  const envKey = process.env.WIZARD_LLM_KEY

  if (envKey) {
    const provider = (process.env.WIZARD_LLM_PROVIDER ?? LLM_PROVIDERS.ANTHROPIC) as LLMProvider
    if (!(provider in LLM_DEFAULTS)) {
      throw new Error(
        `Unknown WIZARD_LLM_PROVIDER: ${provider}. Use: ${Object.values(LLM_PROVIDERS).join(', ')}`,
      )
    }
    const defaults = LLM_DEFAULTS[provider]
    return {
      key: envKey,
      provider,
      model: process.env.WIZARD_LLM_MODEL ?? defaults.model,
      endpoint: defaults.endpoint,
    }
  }

  const provider = await p.select<LLMProvider>({
    message: 'Which LLM provider should the wizard use to analyze your code?',
    options: [
      { value: LLM_PROVIDERS.ANTHROPIC, label: 'Anthropic (Claude)' },
      { value: LLM_PROVIDERS.OPENAI, label: 'OpenAI' },
      { value: LLM_PROVIDERS.GEMINI, label: 'Google Gemini' },
    ],
  })

  if (p.isCancel(provider)) {
    p.cancel('Cancelled.')
    process.exit(0)
  }

  const providerLabels: Record<LLMProvider, string> = {
    [LLM_PROVIDERS.ANTHROPIC]: 'Anthropic',
    [LLM_PROVIDERS.OPENAI]: 'OpenAI',
    [LLM_PROVIDERS.GEMINI]: 'Google',
  }

  const key = await p.password({
    message: `Enter your ${providerLabels[provider]} API key`,
  })

  if (p.isCancel(key) || !key) {
    p.cancel('Cancelled.')
    process.exit(0)
  }

  const defaults = LLM_DEFAULTS[provider]
  return { key, provider, model: defaults.model, endpoint: defaults.endpoint }
}

/**
 * Call the LLM to generate tracing code for the user's agent.
 */
export const callWizardLLM = async (opts: {
  llmConfig: LLMConfig
  framework: Framework
  entryPointPath: string
  entryPointContent: string
  additionalFiles: Record<string, string>
}): Promise<WizardLLMResponse> => {
  const systemPrompt = buildSystemPrompt(opts.framework)
  const userPrompt = buildUserPrompt(opts)
  const text = await callProvider(opts.llmConfig, systemPrompt, userPrompt)
  return validateResponse(extractJson(text))
}

// ---------------------------------------------------------------------------
// Provider adapters — each returns the raw text from the LLM
// ---------------------------------------------------------------------------

const callProvider = async (
  config: LLMConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  switch (config.provider) {
    case LLM_PROVIDERS.ANTHROPIC:
      return callAnthropic(config, systemPrompt, userPrompt)
    case LLM_PROVIDERS.OPENAI:
      return callOpenAI(config, systemPrompt, userPrompt)
    case LLM_PROVIDERS.GEMINI:
      return callGemini(config, systemPrompt, userPrompt)
  }
}

const callAnthropic = async (
  config: LLMConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  const res = await fetchJson(config.endpoint, {
    headers: {
      'Content-Type': CONTENT_TYPE_JSON,
      'x-api-key': config.key,
      'anthropic-version': ANTHROPIC_API_VERSION,
    },
    body: {
      model: config.model,
      max_tokens: LLM_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: LLM_ROLES.USER, content: userPrompt }],
    },
  })

  const msg = res as { content: Array<{ type: string; text?: string }> }
  const textBlock = msg.content?.find((b) => b.type === 'text')
  if (!textBlock?.text) throw new Error('No text in Anthropic response')
  return textBlock.text
}

const callOpenAI = async (
  config: LLMConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  const res = await fetchJson(config.endpoint, {
    headers: {
      'Content-Type': CONTENT_TYPE_JSON,
      Authorization: `Bearer ${config.key}`,
    },
    body: {
      model: config.model,
      max_tokens: LLM_MAX_TOKENS,
      messages: [
        { role: LLM_ROLES.SYSTEM, content: systemPrompt },
        { role: LLM_ROLES.USER, content: userPrompt },
      ],
    },
  })

  const msg = res as { choices: Array<{ message: { content: string } }> }
  const text = msg.choices?.[0]?.message?.content
  if (!text) throw new Error('No text in OpenAI response')
  return text
}

const callGemini = async (
  config: LLMConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  const url = `${config.endpoint}/${config.model}:generateContent?key=${config.key}`

  const res = await fetchJson(url, {
    headers: { 'Content-Type': CONTENT_TYPE_JSON },
    body: {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: LLM_ROLES.USER, parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: LLM_MAX_TOKENS },
    },
  })

  const msg = res as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
  const text = msg.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No text in Gemini response')
  return text
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

const fetchJson = async (
  url: string,
  opts: { headers: Record<string, string>; body: unknown },
): Promise<unknown> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: opts.headers,
      body: JSON.stringify(opts.body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === ABORT_ERROR_NAME) {
      throw new Error(`LLM request timed out after ${LLM_TIMEOUT_MS / 1000}s`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LLM API error (${res.status}): ${body}`)
  }

  return res.json()
}

/** Extract JSON from LLM text that may be wrapped in a fenced code block. */
export const extractJson = (text: string): unknown => {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  const raw = fenced ? fenced[1] : text
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(
      `Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : err}`,
    )
  }
}

/** Validate that LLM output has the required shape with string values. */
export const validateResponse = (data: unknown): WizardLLMResponse => {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('coval_tracing_py' in data) ||
    !('modified_entry_point' in data) ||
    !('explanation' in data)
  ) {
    throw new Error('Invalid LLM response — missing required fields')
  }

  const { coval_tracing_py, modified_entry_point, explanation } = data as Record<string, unknown>
  if (
    typeof coval_tracing_py !== 'string' ||
    typeof modified_entry_point !== 'string' ||
    typeof explanation !== 'string'
  ) {
    throw new Error('Invalid LLM response — expected string fields')
  }

  return { coval_tracing_py, modified_entry_point, explanation }
}

export { FRAMEWORKS }
