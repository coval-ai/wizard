export const COVAL_API_BASE = 'https://api.coval.dev';
export const COVAL_TRACES_ENDPOINT = `${COVAL_API_BASE}/v1/traces`;
export const COVAL_AGENTS_ENDPOINT = `${COVAL_API_BASE}/v1/agents`;
export const COVAL_WIZARD_ENDPOINT = `${COVAL_API_BASE}/v1/wizard/complete`;

export const LLM_MAX_TOKENS = 8192;
export const LLM_TIMEOUT_MS = 120_000;

export type LLMProvider = 'anthropic' | 'openai' | 'gemini';

export const LLM_DEFAULTS: Record<LLMProvider, { endpoint: string; model: string }> = {
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
  },
  gemini: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'gemini-2.5-flash',
  },
};

export const MAX_FILE_SIZE_BYTES = 50 * 1024;

/** Files that indicate a Python project, checked in priority order. */
export const PROJECT_FILES = ['pyproject.toml', 'requirements.txt', 'Pipfile', 'setup.py'] as const;

/** Entry point filenames to look for, in priority order. */
export const ENTRY_POINT_NAMES = ['agent.py', 'main.py', 'bot.py', 'app.py'] as const;
