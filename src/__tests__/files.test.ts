import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { jest } from '@jest/globals';
import { readFile, backupFile, writeFile, fileExists, showDiff } from '../files.js';
import { MAX_FILE_SIZE_BYTES } from '../constants.js';

const makeTempDir = (): string => mkdtempSync(join(tmpdir(), 'wizard-files-test-'));

describe('readFile', () => {
  it('reads file content as utf-8', () => {
    const dir = makeTempDir();
    const path = join(dir, 'test.py');
    writeFileSync(path, 'hello world');
    expect(readFile(path)).toBe('hello world');
  });

  it('still returns content for large files (size check is a warning, not a blocker)', () => {
    const dir = makeTempDir();
    const path = join(dir, 'big.py');
    const bigContent = 'x'.repeat(MAX_FILE_SIZE_BYTES + 1);
    writeFileSync(path, bigContent);

    const result = readFile(path);

    expect(result).toBe(bigContent);
    expect(result.length).toBeGreaterThan(MAX_FILE_SIZE_BYTES);
  });

  it('returns content for files at exactly the size limit', () => {
    const dir = makeTempDir();
    const path = join(dir, 'exact.py');
    const content = 'x'.repeat(MAX_FILE_SIZE_BYTES);
    writeFileSync(path, content);

    const result = readFile(path);
    expect(result.length).toBe(MAX_FILE_SIZE_BYTES);
  });

  it('throws when file does not exist', () => {
    expect(() => readFile('/nonexistent/path.py')).toThrow();
  });
});

describe('backupFile', () => {
  it('creates a .bak copy and returns the backup path', () => {
    const dir = makeTempDir();
    const path = join(dir, 'agent.py');
    writeFileSync(path, 'original content');

    const bakPath = backupFile(path);

    expect(bakPath).toBe(`${path}.bak`);
    expect(readFileSync(bakPath, 'utf-8')).toBe('original content');
    // Original still exists
    expect(readFileSync(path, 'utf-8')).toBe('original content');
  });

  it('overwrites existing backup', () => {
    const dir = makeTempDir();
    const path = join(dir, 'agent.py');
    writeFileSync(path, 'v1');
    writeFileSync(`${path}.bak`, 'old backup');

    backupFile(path);
    expect(readFileSync(`${path}.bak`, 'utf-8')).toBe('v1');
  });
});

describe('writeFile', () => {
  it('writes content to a file', () => {
    const dir = makeTempDir();
    const path = join(dir, 'output.py');

    writeFile(path, 'new content');
    expect(readFileSync(path, 'utf-8')).toBe('new content');
  });

  it('overwrites existing file', () => {
    const dir = makeTempDir();
    const path = join(dir, 'output.py');
    writeFileSync(path, 'old');

    writeFile(path, 'new');
    expect(readFileSync(path, 'utf-8')).toBe('new');
  });
});

describe('fileExists', () => {
  it('returns true for existing file', () => {
    const dir = makeTempDir();
    const path = join(dir, 'exists.py');
    writeFileSync(path, '');
    expect(fileExists(path)).toBe(true);
  });

  it('returns false for non-existent file', () => {
    expect(fileExists('/nonexistent/path.py')).toBe(false);
  });
});

describe('showDiff', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('prints added lines in green and removed lines in red', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    showDiff('line1\nline2\n', 'line1\nline3\n', 'test.py');

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    // The diff should contain both old and new lines
    expect(output).toContain('line2');
    expect(output).toContain('line3');
    logSpy.mockRestore();
  });

  it('handles identical files without crashing', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    showDiff('same\n', 'same\n', 'test.py');
    // Should complete without throwing
    logSpy.mockRestore();
  });
});
