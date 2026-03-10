/** Supported agent frameworks for tracing injection. */
export type Framework = 'pipecat' | 'livekit' | 'generic';

/** Result of scanning a project directory for Python agent code. */
export interface DetectionResult {
  framework: Framework;
  entryPointPath: string;
  projectFile: string;
  additionalFiles: Record<string, string>;
}

/** Structured response from the LLM with generated tracing code. */
export interface WizardLLMResponse {
  coval_tracing_py: string;
  modified_entry_point: string;
  explanation: string;
}
