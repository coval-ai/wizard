#!/usr/bin/env node

import { resolve, join } from 'node:path'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import chalk from 'chalk'
import { getApiKey, verifyApiKey } from './auth.js'
import { detect } from './detect.js'
import { callWizardLLM, getLLMConfig } from './llm.js'
import { readFile, backupFile, showDiff, writeFile, fileExists } from './files.js'
import { sendTestSpan } from './validate.js'
import { FRAMEWORK_LABELS, VERIFY_RESULTS, COVAL_TRACING_FILE } from './constants.js'

const parseArgs = (argv: string[]) => {
  return {
    autoYes: argv.includes('--yes') || argv.includes('-y'),
    targetDir: resolve(argv.find((a) => !a.startsWith('-')) || '.'),
  }
}

const main = async () => {
  const { autoYes, targetDir } = parseArgs(process.argv.slice(2))

  console.log()
  p.intro(chalk.bold('Coval Wizard'))

  // ── Auth ──────────────────────────────────────────────────────────────
  const apiKey = await getApiKey()
  const spinner = p.spinner()

  spinner.start('Verifying API key')
  const authResult = await verifyApiKey(apiKey)
  if (authResult === VERIFY_RESULTS.NETWORK_ERROR) {
    spinner.stop('Could not reach api.coval.dev — check your network and try again', 1)
    process.exit(1)
  }
  if (authResult === VERIFY_RESULTS.INVALID) {
    spinner.stop('API key verification failed', 1)
    p.cancel('Invalid API key. Get one at https://app.coval.dev')
    process.exit(1)
  }
  spinner.stop('API key verified (coval.dev)')

  // ── Detect ────────────────────────────────────────────────────────────
  const detection = detect(targetDir)
  if (!detection) {
    p.cancel("No Python project found. Run this from your agent's project directory.")
    process.exit(1)
  }

  const frameworkLabel = FRAMEWORK_LABELS[detection.framework] ?? detection.framework
  p.log.success('Detected Python project')
  p.log.success(`Framework: ${chalk.bold(frameworkLabel)} (found in ${detection.projectFile})`)
  p.log.success(`Entry point: ${chalk.bold(detection.entryPointPath)}`)

  // ── LLM ───────────────────────────────────────────────────────────────
  const llmConfig = await getLLMConfig()

  const entryPointFullPath = join(targetDir, detection.entryPointPath)
  const entryPointContent = readFile(entryPointFullPath)

  const providerName = llmConfig.provider
  spinner.start(`Analyzing your code with ${providerName}`)
  let result
  try {
    result = await callWizardLLM({
      llmConfig,
      framework: detection.framework,
      entryPointPath: detection.entryPointPath,
      entryPointContent,
      additionalFiles: detection.additionalFiles,
    })
  } catch (err) {
    spinner.stop('Analysis failed', 1)
    p.cancel(`LLM error: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
  spinner.stop('Analysis complete')

  // ── Preview ───────────────────────────────────────────────────────────
  const covalTracingPath = join(targetDir, COVAL_TRACING_FILE)
  const isCreate = !fileExists(covalTracingPath)

  console.log()
  p.log.info('The wizard will make these changes:')
  console.log()
  console.log(`    ${chalk.green(isCreate ? 'CREATE' : 'OVERWRITE')}  ${COVAL_TRACING_FILE}`)
  console.log(
    `    ${chalk.yellow('MODIFY')}  ${detection.entryPointPath}  ${chalk.dim(`(backup → ${detection.entryPointPath}.bak)`)}`,
  )
  console.log()

  p.log.info(`${detection.entryPointPath} diff:`)
  showDiff(entryPointContent, result.modified_entry_point, detection.entryPointPath)
  console.log()
  p.log.message(result.explanation)
  console.log()

  // ── Confirm ───────────────────────────────────────────────────────────
  if (!autoYes) {
    const ok = await p.confirm({ message: 'Apply these changes?' })
    if (p.isCancel(ok) || !ok) {
      p.cancel('No changes made.')
      process.exit(0)
    }
  }

  // ── Apply ─────────────────────────────────────────────────────────────
  backupFile(entryPointFullPath)
  if (!isCreate) {
    backupFile(covalTracingPath)
  }
  writeFile(covalTracingPath, result.coval_tracing_py)
  writeFile(entryPointFullPath, result.modified_entry_point)
  p.log.success(`${isCreate ? 'Created' : 'Updated'} ${COVAL_TRACING_FILE}`)
  p.log.success(`Modified ${detection.entryPointPath}`)

  // ── Validate ──────────────────────────────────────────────────────────
  let shouldValidate = true
  if (!autoYes) {
    const v = await p.confirm({ message: 'Run validation now?' })
    shouldValidate = !p.isCancel(v) && !!v
  }

  if (shouldValidate) {
    spinner.start('Sending test span to api.coval.dev')
    const ok = await sendTestSpan(apiKey)
    spinner.stop(
      ok ? 'Test span accepted by api.coval.dev' : 'Test span failed — check your API key',
      ok ? 0 : 1,
    )
  }

  // ── Done ──────────────────────────────────────────────────────────────
  console.log()
  p.note(
    [
      `Set ${chalk.bold('COVAL_API_KEY')} in your agent's environment`,
      'Deploy your updated agent',
      'Run a simulation → traces appear in your Coval dashboard',
    ].join('\n'),
    'Next steps',
  )
  p.outro("You're all set!")
}

try {
  const realSelf = realpathSync(fileURLToPath(import.meta.url))
  const realArgv = realpathSync(process.argv[1] ?? '')
  if (realSelf === realArgv) {
    main().catch((err) => {
      console.error(chalk.red(err.message || err))
      process.exit(1)
    })
  }
} catch {
  // not the entry point — imported as a module
}
