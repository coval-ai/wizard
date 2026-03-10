# Wizard Style Guide

**Read `.coderabbit.yaml` for all code style rules.** It contains path-specific instructions for TypeScript, tests, and CI workflows.

Key points:
- Strict TypeScript: no `any`, no unused imports, no `console.log` in library code
- `type` over `interface` for simple shapes
- Named exports; no default exports except entry point
- AbortSignal.timeout() for all outbound fetch calls
- Constants for all API URLs and magic values (`src/constants.ts`, `src/types.ts`)
- `@clack/prompts` for all user output (no `console.log` in library code)
- Vitest with real temp directories for filesystem tests
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, no AI attribution
