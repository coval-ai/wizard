import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect } from 'vitest';
import { detectPythonProject, detectFramework, findEntryPoint, detect } from '../detect.js';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'wizard-test-'));
}

function touch(dir: string, filename: string, content = '') {
  writeFileSync(join(dir, filename), content);
}

describe('detectPythonProject', () => {
  it('finds pyproject.toml', () => {
    const dir = makeTempDir();
    touch(dir, 'pyproject.toml');
    expect(detectPythonProject(dir)).toBe('pyproject.toml');
  });

  it('finds requirements.txt', () => {
    const dir = makeTempDir();
    touch(dir, 'requirements.txt', 'flask\n');
    expect(detectPythonProject(dir)).toBe('requirements.txt');
  });

  it('prefers pyproject.toml over requirements.txt', () => {
    const dir = makeTempDir();
    touch(dir, 'pyproject.toml');
    touch(dir, 'requirements.txt');
    expect(detectPythonProject(dir)).toBe('pyproject.toml');
  });

  it('returns null for empty directory', () => {
    const dir = makeTempDir();
    expect(detectPythonProject(dir)).toBeNull();
  });
});

describe('detectFramework', () => {
  it('detects pipecat from pyproject.toml', () => {
    const dir = makeTempDir();
    touch(dir, 'pyproject.toml', 'dependencies = ["pipecat-ai>=0.1"]');
    expect(detectFramework(dir)).toBe('pipecat');
  });

  it('detects livekit from requirements.txt', () => {
    const dir = makeTempDir();
    touch(dir, 'requirements.txt', 'livekit-agents\n');
    expect(detectFramework(dir)).toBe('livekit');
  });

  it('detects pipecat from Python imports', () => {
    const dir = makeTempDir();
    touch(dir, 'bot.py', 'from pipecat.pipeline import Pipeline\n');
    expect(detectFramework(dir)).toBe('pipecat');
  });

  it('detects livekit from Python imports', () => {
    const dir = makeTempDir();
    touch(dir, 'agent.py', 'from livekit.agents import AgentSession\n');
    expect(detectFramework(dir)).toBe('livekit');
  });

  it('returns generic for unknown project', () => {
    const dir = makeTempDir();
    touch(dir, 'app.py', 'import flask\n');
    expect(detectFramework(dir)).toBe('generic');
  });

  it('returns generic for empty directory', () => {
    const dir = makeTempDir();
    expect(detectFramework(dir)).toBe('generic');
  });
});

describe('findEntryPoint', () => {
  it('prefers agent.py', () => {
    const dir = makeTempDir();
    touch(dir, 'agent.py');
    touch(dir, 'main.py');
    expect(findEntryPoint(dir)).toBe('agent.py');
  });

  it('falls back to main.py', () => {
    const dir = makeTempDir();
    touch(dir, 'main.py');
    expect(findEntryPoint(dir)).toBe('main.py');
  });

  it('finds sole .py file', () => {
    const dir = makeTempDir();
    touch(dir, 'my_bot.py');
    expect(findEntryPoint(dir)).toBe('my_bot.py');
  });

  it('ignores coval_tracing.py', () => {
    const dir = makeTempDir();
    touch(dir, 'coval_tracing.py');
    touch(dir, 'server.py');
    expect(findEntryPoint(dir)).toBe('server.py');
  });

  it('returns null when ambiguous', () => {
    const dir = makeTempDir();
    touch(dir, 'foo.py');
    touch(dir, 'bar.py');
    expect(findEntryPoint(dir)).toBeNull();
  });

  it('returns null for empty directory', () => {
    const dir = makeTempDir();
    expect(findEntryPoint(dir)).toBeNull();
  });
});

describe('detect (full pipeline)', () => {
  it('detects a LiveKit project end-to-end', () => {
    const dir = makeTempDir();
    touch(dir, 'pyproject.toml', 'dependencies = ["livekit-agents"]');
    touch(dir, 'agent.py', 'from livekit.agents import AgentSession\n');

    const result = detect(dir);
    expect(result).not.toBeNull();
    expect(result!.framework).toBe('livekit');
    expect(result!.entryPointPath).toBe('agent.py');
    expect(result!.projectFile).toBe('pyproject.toml');
    expect(result!.additionalFiles).toHaveProperty('pyproject.toml');
  });

  it('returns null without a project file', () => {
    const dir = makeTempDir();
    touch(dir, 'agent.py');
    expect(detect(dir)).toBeNull();
  });

  it('returns null without an entry point', () => {
    const dir = makeTempDir();
    touch(dir, 'pyproject.toml');
    // No .py files
    expect(detect(dir)).toBeNull();
  });
});
