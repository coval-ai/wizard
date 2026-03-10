import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_FILES, ENTRY_POINT_NAMES } from './constants.js';
import type { Framework, DetectionResult } from './types.js';

/** Safely read a file, returning null on error. */
function tryRead(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

/** Find the first project manifest file that exists. */
export function detectPythonProject(dir: string): string | null {
  for (const f of PROJECT_FILES) {
    if (existsSync(join(dir, f))) return f;
  }
  return null;
}

/** Determine framework from dependency files and Python imports. */
export function detectFramework(dir: string): Framework {
  // Check dependency manifests
  for (const f of PROJECT_FILES) {
    const content = tryRead(join(dir, f));
    if (!content) continue;
    if (/pipecat[-_]ai|"pipecat"/.test(content)) return 'pipecat';
    if (/livekit[-_]agents|"livekit"/.test(content)) return 'livekit';
  }

  // Scan .py files for framework imports
  try {
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.py'))) {
      const content = tryRead(join(dir, f));
      if (!content) continue;
      if (/from pipecat|import pipecat/.test(content)) return 'pipecat';
      if (/from livekit|import livekit/.test(content)) return 'livekit';
    }
  } catch {
    // directory not readable
  }

  return 'generic';
}

/** Find the most likely entry point file. */
export function findEntryPoint(dir: string): string | null {
  for (const name of ENTRY_POINT_NAMES) {
    if (existsSync(join(dir, name))) return name;
  }

  // Fall back to sole .py file in root
  try {
    const pyFiles = readdirSync(dir).filter(
      (f) => f.endsWith('.py') && !f.startsWith('_') && f !== 'coval_tracing.py',
    );
    if (pyFiles.length === 1) return pyFiles[0];
  } catch {
    // directory not readable
  }

  return null;
}

/** Collect contents of any project manifest files for LLM context. */
function gatherAdditionalFiles(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const f of PROJECT_FILES) {
    const content = tryRead(join(dir, f));
    if (content) files[f] = content;
  }
  return files;
}

/** Run full project detection: find project file, framework, and entry point. */
export function detect(dir: string): DetectionResult | null {
  const projectFile = detectPythonProject(dir);
  if (!projectFile) return null;

  const framework = detectFramework(dir);
  const entryPointPath = findEntryPoint(dir);
  if (!entryPointPath) return null;

  return {
    framework,
    entryPointPath,
    projectFile,
    additionalFiles: gatherAdditionalFiles(dir),
  };
}
