import {
  ANTHROPIC_API_ENDPOINT,
  COVAL_WIZARD_ENDPOINT,
  LLM_MODEL,
  LLM_MAX_TOKENS,
} from './constants.js';
import { buildSystemPrompt, buildUserPrompt } from './prompts.js';
import type { Framework, WizardLLMResponse } from './types.js';

/**
 * Call the LLM to generate tracing code for the user's agent.
 * Routes to Anthropic direct (if WIZARD_LLM_KEY set) or Coval proxy.
 */
export async function callWizardLLM(opts: {
  apiKey: string;
  framework: Framework;
  entryPointPath: string;
  entryPointContent: string;
  additionalFiles: Record<string, string>;
}): Promise<WizardLLMResponse> {
  const systemPrompt = buildSystemPrompt(opts.framework);
  const userPrompt = buildUserPrompt(opts);

  const llmKey = process.env.WIZARD_LLM_KEY;
  if (llmKey) {
    return fetchLLM(ANTHROPIC_API_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': llmKey,
        'anthropic-version': '2023-06-01',
      },
      body: {
        model: LLM_MODEL,
        max_tokens: LLM_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      },
      extractJson: extractFromAnthropicResponse,
    });
  }

  return fetchLLM(COVAL_WIZARD_ENDPOINT, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
    },
    body: { system: systemPrompt, user: userPrompt },
    extractJson: (data: unknown) => data,
  });
}

/** Generic fetch-parse-validate pipeline for LLM calls. */
async function fetchLLM(
  url: string,
  opts: {
    headers: Record<string, string>;
    body: unknown;
    extractJson: (data: unknown) => unknown;
  },
): Promise<WizardLLMResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: opts.headers,
    body: JSON.stringify(opts.body),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM API error (${res.status}): ${body}`);
  }

  const raw = opts.extractJson(await res.json());
  return validateResponse(raw);
}

/** Extract text content from Anthropic Messages API response and parse JSON. */
function extractFromAnthropicResponse(data: unknown): unknown {
  const msg = data as { content: Array<{ type: string; text?: string }> };
  const textBlock = msg.content?.find((b) => b.type === 'text');
  if (!textBlock?.text) throw new Error('No text response from Claude');

  let json = textBlock.text;
  const fenced = json.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) json = fenced[1];

  return JSON.parse(json);
}

/** Validate that LLM output has the required shape. */
export function validateResponse(data: unknown): WizardLLMResponse {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('coval_tracing_py' in data) ||
    !('modified_entry_point' in data) ||
    !('explanation' in data)
  ) {
    throw new Error('Invalid LLM response — missing required fields');
  }
  return data as WizardLLMResponse;
}
