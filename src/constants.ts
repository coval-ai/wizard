export const COVAL_API_BASE = 'https://api.coval.dev'
export const COVAL_TRACES_ENDPOINT = `${COVAL_API_BASE}/v1/traces`
export const COVAL_AGENTS_ENDPOINT = `${COVAL_API_BASE}/v1/agents`

export const COVAL_API_KEY_ENV = 'COVAL_API_KEY'
export const AUTH_TIMEOUT_MS = 10_000

export const LLM_MAX_TOKENS = 8192
export const LLM_TIMEOUT_MS = 120_000

export const LLM_PROVIDERS = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  GEMINI: 'gemini',
} as const

export const LLM_ROLES = {
  SYSTEM: 'system',
  USER: 'user',
} as const

export const ABORT_ERROR_NAME = 'AbortError'
export const ANTHROPIC_API_VERSION = '2023-06-01'
export const CONTENT_TYPE_JSON = 'application/json'

export const FRAMEWORKS = {
  PIPECAT: 'pipecat',
  LIVEKIT: 'livekit',
  GENERIC: 'generic',
} as const

export type LLMProvider = (typeof LLM_PROVIDERS)[keyof typeof LLM_PROVIDERS]
export type Framework = (typeof FRAMEWORKS)[keyof typeof FRAMEWORKS]

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  [FRAMEWORKS.PIPECAT]: 'Pipecat',
  [FRAMEWORKS.LIVEKIT]: 'LiveKit Agents',
  [FRAMEWORKS.GENERIC]: 'Generic Python',
}

export const VERIFY_RESULTS = {
  OK: 'ok',
  INVALID: 'invalid',
  NETWORK_ERROR: 'network_error',
} as const

export const COVAL_TRACING_FILE = 'coval_tracing.py'
export const HTTP_METHOD_POST = 'POST'

export const VALIDATE_SIM_ID = 'wizard-test'
export const VALIDATE_SERVICE_NAME = 'coval-wizard-test'
export const VALIDATE_SCOPE_NAME = 'coval.wizard'
export const VALIDATE_SPAN_NAME = 'wizard-validation-span'

export const LLM_DEFAULTS: Record<LLMProvider, { endpoint: string; model: string }> = {
  [LLM_PROVIDERS.ANTHROPIC]: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
  },
  [LLM_PROVIDERS.OPENAI]: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
  },
  [LLM_PROVIDERS.GEMINI]: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'gemini-2.5-flash',
  },
}

export const MAX_FILE_SIZE_BYTES = 50 * 1024

/** Files that indicate a Python project, checked in priority order. */
export const PROJECT_FILES = ['pyproject.toml', 'requirements.txt', 'Pipfile', 'setup.py'] as const

/** Entry point filenames to look for, in priority order. */
export const ENTRY_POINT_NAMES = ['agent.py', 'main.py', 'bot.py', 'app.py'] as const
