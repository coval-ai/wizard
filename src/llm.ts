import type { Framework } from "./detect.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";

export interface WizardLLMResponse {
  coval_tracing_py: string;
  modified_entry_point: string;
  explanation: string;
}

export async function callWizardLLM(opts: {
  apiKey: string;
  framework: Framework;
  entryPointPath: string;
  entryPointContent: string;
  additionalFiles: Record<string, string>;
}): Promise<WizardLLMResponse> {
  const systemPrompt = buildSystemPrompt(opts.framework);
  const userPrompt = buildUserPrompt({
    framework: opts.framework,
    entryPointPath: opts.entryPointPath,
    entryPointContent: opts.entryPointContent,
    additionalFiles: opts.additionalFiles,
  });

  // Local dev: use Anthropic SDK directly
  if (process.env.ANTHROPIC_API_KEY) {
    return callAnthropicDirect(systemPrompt, userPrompt);
  }

  // Production: call Coval API proxy
  return callCovalProxy(opts.apiKey, systemPrompt, userPrompt);
}

async function callCovalProxy(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<WizardLLMResponse> {
  const res = await fetch("https://api.coval.dev/v1/wizard/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      system: systemPrompt,
      user: userPrompt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Coval API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  return validateResponse(data);
}

async function callAnthropicDirect(
  systemPrompt: string,
  userPrompt: string
): Promise<WizardLLMResponse> {
  // Dynamic import to avoid requiring the SDK in production
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514" as any,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Extract JSON from response (may be wrapped in markdown code block)
  let jsonStr = textBlock.text;
  const match = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) {
    jsonStr = match[1];
  }

  const parsed = JSON.parse(jsonStr);
  return validateResponse(parsed);
}

function validateResponse(data: unknown): WizardLLMResponse {
  if (
    typeof data !== "object" ||
    data === null ||
    !("coval_tracing_py" in data) ||
    !("modified_entry_point" in data) ||
    !("explanation" in data)
  ) {
    throw new Error("Invalid response from LLM — missing required fields");
  }
  return data as WizardLLMResponse;
}
