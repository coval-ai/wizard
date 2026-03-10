import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { createTwoFilesPatch } from "diff";
import chalk from "chalk";

const MAX_FILE_SIZE = 50 * 1024; // 50KB

export function readFile(path: string): string {
  const content = readFileSync(path, "utf-8");
  if (content.length > MAX_FILE_SIZE) {
    console.warn(
      chalk.yellow(`  Warning: ${path} is ${(content.length / 1024).toFixed(0)}KB — large files may reduce LLM quality`)
    );
  }
  return content;
}

export function backupFile(path: string): string {
  const bakPath = `${path}.bak`;
  copyFileSync(path, bakPath);
  return bakPath;
}

export function showDiff(
  original: string,
  modified: string,
  filename: string
): void {
  const patch = createTwoFilesPatch(
    `a/${filename}`,
    `b/${filename}`,
    original,
    modified
  );

  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      console.log(chalk.green(line));
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      console.log(chalk.red(line));
    } else if (line.startsWith("@@")) {
      console.log(chalk.cyan(line));
    } else {
      console.log(line);
    }
  }
}

export function writeFile(path: string, content: string): void {
  writeFileSync(path, content, "utf-8");
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}
