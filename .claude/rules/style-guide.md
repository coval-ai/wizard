# Wizard Style Guide

## TypeScript Conventions
- Strict mode, ES2022 target
- Single quotes, trailing commas, 100-char line width (see `.prettierrc`)
- Prefer `type` over `interface` for simple shapes
- Use named exports; no default exports except entry point
- Shared types in `src/types.ts`, constants in `src/constants.ts`

## File Naming
- `kebab-case.ts` for files
- `__tests__/` directory co-located with source
- Test files: `*.test.ts`

## Code Patterns
- `tryRead()` pattern for safe file reads (return null on error)
- Constants for all API URLs and magic values
- No `console.log` in library code — use `@clack/prompts` for user output
- JSDoc only where it adds value (not obvious from name/types)

## Commit Format
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- No AI attribution in commits

## Testing
- Vitest with globals
- Real temp directories for filesystem tests (no mocking fs)
- `vi.spyOn(globalThis, 'fetch')` for network tests
- Test the contract, not the implementation
