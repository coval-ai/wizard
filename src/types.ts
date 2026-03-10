export type { Framework, LLMProvider } from './constants.js'

/** Result of scanning a project directory for Python agent code. */
export type DetectionResult = {
  framework: string
  entryPointPath: string
  projectFile: string
  additionalFiles: Record<string, string>
}

/** Structured response from the LLM with generated tracing code. */
export type WizardLLMResponse = {
  coval_tracing_py: string
  modified_entry_point: string
  explanation: string
}
