import {
  COVAL_WIZARD_ENDPOINT,
  LLM_DEFAULTS,
  LLM_MAX_TOKENS,
  LLM_TIMEOUT_MS,
  type LLMProvider,
} from './constants.js';
import { buildSystemPrompt, buildUserPrompt } from './prompts.js';
import type { Framework, WizardLLMResponse } from './types.js';

/**
 * Resolve LLM configuration from environment variables.
 *
 * - `WIZARD_LLM_KEY` — API key for direct LLM calls (skips Coval proxy)
 * - `WIZARD_LLM_PROVIDER` — `anthropic` | `openai` | `gemini` (default: `anthropic`)
 * - `WIZARD_LLM_MODEL` — override the default model for the provider
 */
const resolveLLMConfig = () => {
  const key = process.env.WIZARD_LLM_KEY;
  if (!key) return null;

  const provider = (process.env.WIZARD_LLM_PROVIDER ?? 'anthropic') as LLMProvider;
  if (!(provider in LLM_DEFAULTS)) {
    throw new Error(`Unknown WIZARD_LLM_PROVIDER: ${provider}. Use: anthropic, openai, gemini`);
  }

  const defaults = LLM_DEFAULTS[provider];
  const model = process.env.WIZARD_LLM_MODEL ?? defaults.model;

  return { key, provider, model, endpoint: defaults.endpoint };
};

/**
 * Call the LLM to generate tracing code for the user's agent.
 * Routes to a direct provider (if WIZARD_LLM_KEY set) or the Coval proxy.
 */
export const callWizardLLM = async (opts: {
  apiKey: string;
  framework: Framework;
  entryPointPath: string;
  entryPointContent: string;
  additionalFiles: Record<string, string>;
}): Promise<WizardLLMResponse> => {
  const systemPrompt = buildSystemPrompt(opts.framework);
  const userPrompt = buildUserPrompt(opts);

  const config = resolveLLMConfig();
  if (config) {
    const text = await callProvider(config, systemPrompt, userPrompt);
    return validateResponse(extractJson(text));
  }

  return callCovalProxy(opts.apiKey, systemPrompt, userPrompt);
};

// ---------------------------------------------------------------------------
// Provider adapters — each returns the raw text from the LLM
// ---------------------------------------------------------------------------

type ProviderConfig = NonNullable<ReturnType<typeof resolveLLMConfig>>;

const callProvider = async (
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  switch (config.provider) {
    case 'anthropic':
      return callAnthropic(config, systemPrompt, userPrompt);
    case 'openai':
      return callOpenAI(config, systemPrompt, userPrompt);
    case 'gemini':
      return callGemini(config, systemPrompt, userPrompt);
  }
};

const callAnthropic = async (
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  const res = await fetchJson(config.endpoint, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.key,
      'anthropic-version': '2023-06-01',
    },
    body: {
      model: config.model,
      max_tokens: LLM_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    },
  });

  const msg = res as { content: Array<{ type: string; text?: string }> };
  const textBlock = msg.content?.find((b) => b.type === 'text');
  if (!textBlock?.text) throw new Error('No text in Anthropic response');
  return textBlock.text;
};

const callOpenAI = async (
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  const res = await fetchJson(config.endpoint, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.key}`,
    },
    body: {
      model: config.model,
      max_tokens: LLM_MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    },
  });

  const msg = res as { choices: Array<{ message: { content: string } }> };
  const text = msg.choices?.[0]?.message?.content;
  if (!text) throw new Error('No text in OpenAI response');
  return text;
};

const callGemini = async (
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  const url = `${config.endpoint}/${config.model}:generateContent?key=${config.key}`;

  const res = await fetchJson(url, {
    headers: { 'Content-Type': 'application/json' },
    body: {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: LLM_MAX_TOKENS },
    },
  });

  const msg = res as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  const text = msg.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No text in Gemini response');
  return text;
};

// ---------------------------------------------------------------------------
// Coval proxy fallback
// ---------------------------------------------------------------------------

const callCovalProxy = async (
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<WizardLLMResponse> => {
  const data = await fetchJson(COVAL_WIZARD_ENDPOINT, {
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: { system: systemPrompt, user: userPrompt },
  });
  return validateResponse(data);
};

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

const fetchJson = async (
  url: string,
  opts: { headers: Record<string, string>; body: unknown },
): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: opts.headers,
      body: JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`LLM request timed out after ${LLM_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM API error (${res.status}): ${body}`);
  }

  return res.json();
};

/** Extract JSON from LLM text that may be wrapped in a fenced code block. */
export const extractJson = (text: string): unknown => {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : err}`,
    );
  }
};

/** Validate that LLM output has the required shape with string values. */
export const validateResponse = (data: unknown): WizardLLMResponse => {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('coval_tracing_py' in data) ||
    !('modified_entry_point' in data) ||
    !('explanation' in data)
  ) {
    throw new Error('Invalid LLM response — missing required fields');
  }

  const { coval_tracing_py, modified_entry_point, explanation } = data as Record<string, unknown>;
  if (
    typeof coval_tracing_py !== 'string' ||
    typeof modified_entry_point !== 'string' ||
    typeof explanation !== 'string'
  ) {
    throw new Error('Invalid LLM response — expected string fields');
  }

  return { coval_tracing_py, modified_entry_point, explanation };
};
