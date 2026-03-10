#!/usr/bin/env node

import { resolve, join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { getApiKey, verifyApiKey } from "./auth.js";
import { detect } from "./detect.js";
import { callWizardLLM } from "./llm.js";
import { readFile, backupFile, showDiff, writeFile, fileExists } from "./files.js";
import { sendTestSpan } from "./validate.js";

const args = process.argv.slice(2);
const autoYes = args.includes("--yes") || args.includes("-y");
const targetDir = resolve(
  args.find((a) => !a.startsWith("-")) || "."
);

async function main() {
  console.log();
  p.intro(chalk.bold("Coval Wizard"));

  // 1. Auth
  const apiKey = await getApiKey();
  const verifySpinner = p.spinner();
  verifySpinner.start("Verifying API key");
  const valid = await verifyApiKey(apiKey);
  if (!valid) {
    verifySpinner.stop("API key verification failed", 1);
    p.cancel("Invalid API key. Get one at https://app.coval.dev");
    process.exit(1);
  }
  verifySpinner.stop("API key verified (coval.dev)");

  // 2. Detect
  const detection = detect(targetDir);
  if (!detection) {
    p.cancel(
      "No Python project found. Run this from your agent's project directory."
    );
    process.exit(1);
  }

  p.log.success(`Detected Python project`);
  p.log.success(
    `Framework: ${chalk.bold(frameworkLabel(detection.framework))} (found in ${detection.projectFile})`
  );
  p.log.success(`Entry point: ${chalk.bold(detection.entryPointPath)}`);

  // 3. Read entry point
  const entryPointFullPath = join(targetDir, detection.entryPointPath);
  const entryPointContent = readFile(entryPointFullPath);

  // 4. Call LLM
  const llmSpinner = p.spinner();
  llmSpinner.start("Analyzing your code with Claude");

  let result;
  try {
    result = await callWizardLLM({
      apiKey,
      framework: detection.framework,
      entryPointPath: detection.entryPointPath,
      entryPointContent,
      additionalFiles: detection.additionalFiles,
    });
  } catch (err) {
    llmSpinner.stop("Analysis failed", 1);
    p.cancel(`LLM error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
  llmSpinner.stop("Analysis complete");

  // 5. Show changes
  console.log();
  p.log.info("The wizard will make these changes:");
  console.log();

  const covalTracingPath = join(targetDir, "coval_tracing.py");
  const willCreate = !fileExists(covalTracingPath);

  console.log(
    `    ${chalk.green(willCreate ? "CREATE" : "OVERWRITE")}  coval_tracing.py`
  );
  console.log(
    `    ${chalk.yellow("MODIFY")}  ${detection.entryPointPath}  ${chalk.dim("(backup → " + detection.entryPointPath + ".bak)")}`
  );
  console.log();

  // Show diff for entry point
  p.log.info(`${detection.entryPointPath} diff:`);
  showDiff(entryPointContent, result.modified_entry_point, detection.entryPointPath);
  console.log();

  p.log.message(result.explanation);
  console.log();

  // 6. Confirm
  if (!autoYes) {
    const confirm = await p.confirm({
      message: "Apply these changes?",
    });
    if (p.isCancel(confirm) || !confirm) {
      p.cancel("No changes made.");
      process.exit(0);
    }
  }

  // 7. Apply
  backupFile(entryPointFullPath);
  writeFile(covalTracingPath, result.coval_tracing_py);
  writeFile(entryPointFullPath, result.modified_entry_point);

  p.log.success(`Created coval_tracing.py`);
  p.log.success(`Modified ${detection.entryPointPath}`);

  // 8. Validate
  let shouldValidate = true;
  if (!autoYes) {
    const validateConfirm = await p.confirm({
      message: "Run validation now?",
    });
    shouldValidate = !p.isCancel(validateConfirm) && !!validateConfirm;
  }

  if (shouldValidate) {
    const validateSpinner = p.spinner();
    validateSpinner.start("Sending test span to api.coval.dev");
    const ok = await sendTestSpan(apiKey);
    if (ok) {
      validateSpinner.stop("Test span accepted by api.coval.dev");
    } else {
      validateSpinner.stop("Test span failed — check your API key and network", 1);
    }
  }

  // 9. Next steps
  console.log();
  p.note(
    [
      `Set ${chalk.bold("COVAL_API_KEY")} in your agent's environment`,
      `Deploy your updated agent`,
      `Run a simulation → traces appear in your Coval dashboard`,
    ].join("\n"),
    "Next steps"
  );

  p.outro("You're all set!");
}

function frameworkLabel(fw: string): string {
  switch (fw) {
    case "pipecat":
      return "Pipecat";
    case "livekit":
      return "LiveKit Agents";
    default:
      return "Generic Python";
  }
}

main().catch((err) => {
  console.error(chalk.red(err.message || err));
  process.exit(1);
});
