import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Framework = "pipecat" | "livekit" | "generic";

export interface DetectionResult {
  framework: Framework;
  entryPointPath: string;
  projectFile: string;
  additionalFiles: Record<string, string>;
}

const PROJECT_FILES = [
  "pyproject.toml",
  "requirements.txt",
  "Pipfile",
  "setup.py",
];

export function detectPythonProject(dir: string): string | null {
  for (const f of PROJECT_FILES) {
    if (existsSync(join(dir, f))) return f;
  }
  return null;
}

export function detectFramework(dir: string): Framework {
  // Check dependency files for framework imports
  for (const f of PROJECT_FILES) {
    const path = join(dir, f);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      if (/pipecat[-_]ai|pipecat/.test(content)) return "pipecat";
      if (/livekit[-_]agents|livekit/.test(content)) return "livekit";
    } catch {}
  }

  // Scan .py files in root for imports
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".py"));
    for (const f of files) {
      try {
        const content = readFileSync(join(dir, f), "utf-8");
        if (/from pipecat|import pipecat/.test(content)) return "pipecat";
        if (/from livekit|import livekit/.test(content)) return "livekit";
      } catch {}
    }
  } catch {}

  return "generic";
}

export function findEntryPoint(dir: string): string | null {
  // Prefer known names
  for (const name of ["agent.py", "main.py", "bot.py", "app.py"]) {
    if (existsSync(join(dir, name))) return name;
  }

  // Fall back to single .py file
  try {
    const pyFiles = readdirSync(dir).filter(
      (f) => f.endsWith(".py") && !f.startsWith("_") && f !== "coval_tracing.py"
    );
    if (pyFiles.length === 1) return pyFiles[0];
  } catch {}

  return null;
}

export function detect(dir: string): DetectionResult | null {
  const projectFile = detectPythonProject(dir);
  if (!projectFile) return null;

  const framework = detectFramework(dir);
  const entryPointPath = findEntryPoint(dir);
  if (!entryPointPath) return null;

  // Collect additional context files
  const additionalFiles: Record<string, string> = {};
  for (const f of PROJECT_FILES) {
    const path = join(dir, f);
    if (existsSync(path)) {
      try {
        additionalFiles[f] = readFileSync(path, "utf-8");
      } catch {}
    }
  }

  return { framework, entryPointPath, projectFile, additionalFiles };
}
