import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createTwoFilesPatch } from 'diff'
import chalk from 'chalk'
import * as p from '@clack/prompts'
import { MAX_FILE_SIZE_BYTES, OTEL_PACKAGES } from './constants.js'

export const readFile = (path: string): string => {
  const content = readFileSync(path, 'utf-8')
  const byteLength = Buffer.byteLength(content, 'utf-8')
  if (byteLength > MAX_FILE_SIZE_BYTES) {
    const sizeKB = (byteLength / 1024).toFixed(0)
    p.log.warn(chalk.yellow(`${path} is ${sizeKB}KB — large files may reduce LLM quality`))
  }
  return content
}

/** Create a `.bak` copy of a file. Returns the backup path. */
export const backupFile = (path: string): string => {
  const bakPath = `${path}.bak`
  copyFileSync(path, bakPath)
  return bakPath
}

/** Print a colored unified diff to stdout. */
export const showDiff = (original: string, modified: string, filename: string): void => {
  const patch = createTwoFilesPatch(`a/${filename}`, `b/${filename}`, original, modified)
  for (const line of patch.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      console.log(chalk.green(line))
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      console.log(chalk.red(line))
    } else if (line.startsWith('@@')) {
      console.log(chalk.cyan(line))
    } else {
      console.log(line)
    }
  }
}

export const writeFile = (path: string, content: string): void => {
  writeFileSync(path, content, 'utf-8')
}

export const fileExists = (path: string): boolean => existsSync(path)

/**
 * Add missing OTel packages to the project's dependency file.
 * Handles requirements.txt (plain append) and pyproject.toml (injects into dependencies array).
 * Returns the list of packages that were added, or an empty array if none were missing.
 */
/**
 * Add missing OTel packages to the project's dependency file.
 * Prefers requirements.txt when it exists (used by pip/Docker), falling back
 * to pyproject.toml. Returns the list of packages added, or [] if none.
 */
export const addOtelDeps = (dir: string, projectFile: string): readonly string[] => {
  // Always prefer requirements.txt when present — pip/Docker deployments use it
  // regardless of whether pyproject.toml was detected as the primary project file.
  const reqTxt = join(dir, 'requirements.txt')
  const targetFile = existsSync(reqTxt) ? 'requirements.txt' : projectFile
  const filePath = join(dir, targetFile)
  const content = readFileSync(filePath, 'utf-8')

  const missing = OTEL_PACKAGES.filter((pkg) => {
    const name = pkg.split('>=')[0]
    return !content.includes(name)
  })

  if (missing.length === 0) return []

  if (targetFile === 'requirements.txt') {
    writeFileSync(filePath, content.trimEnd() + '\n' + missing.join('\n') + '\n', 'utf-8')
  } else if (targetFile === 'pyproject.toml') {
    // Match the closing ] that sits on its own line to avoid matching ] inside
    // package extras like pipecat-ai[daily,openai]>=0.0.60
    const updated = content.replace(
      /(\[project\][\s\S]*?dependencies\s*=\s*\[)([\s\S]*?)(\n\])/,
      (_, open: string, inner: string, close: string) => {
        const additions = missing.map((p) => `    "${p}",`).join('\n')
        return `${open}${inner}\n${additions}${close}`
      },
    )
    if (updated !== content) writeFileSync(filePath, updated, 'utf-8')
  }

  return missing
}
