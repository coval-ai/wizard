import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { createTwoFilesPatch } from 'diff';
import chalk from 'chalk';
import * as p from '@clack/prompts';
import { MAX_FILE_SIZE_BYTES } from './constants.js';

export function readFile(path: string): string {
  const content = readFileSync(path, 'utf-8');
  const byteLength = Buffer.byteLength(content, 'utf-8');
  if (byteLength > MAX_FILE_SIZE_BYTES) {
    const sizeKB = (byteLength / 1024).toFixed(0);
    p.log.warn(chalk.yellow(`${path} is ${sizeKB}KB — large files may reduce LLM quality`));
  }
  return content;
}

/** Create a `.bak` copy of a file. Returns the backup path. */
export function backupFile(path: string): string {
  const bakPath = `${path}.bak`;
  copyFileSync(path, bakPath);
  return bakPath;
}

/** Print a colored unified diff to stdout. */
export function showDiff(original: string, modified: string, filename: string): void {
  const patch = createTwoFilesPatch(`a/${filename}`, `b/${filename}`, original, modified);
  for (const line of patch.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      console.log(chalk.green(line));
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      console.log(chalk.red(line));
    } else if (line.startsWith('@@')) {
      console.log(chalk.cyan(line));
    } else {
      console.log(line);
    }
  }
}

export function writeFile(path: string, content: string): void {
  writeFileSync(path, content, 'utf-8');
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}
