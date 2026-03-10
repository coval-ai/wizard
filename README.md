# @coval/wizard

```
            (__)
            (oo)
    /--------\/
   / |      ||
  *  /\----/\
     ~~    ~~
  "Let me trace that for you."
```

Add [Coval](https://coval.dev) OTel tracing to your AI agent with one command.

The wizard reads your Python agent code, uses Claude to figure out exactly where to inject tracing, and writes the changes for you — with diffs, backups, and validation.

## Quick Start

```bash
npx @coval/wizard
```

That's it. Run it from your agent's project directory and follow the prompts.

## What It Does

1. **Detects** your Python project and framework (Pipecat, LiveKit Agents, or generic)
2. **Analyzes** your entry point with Claude to determine the minimal changes needed
3. **Shows** a colored diff of proposed changes and asks for confirmation
4. **Creates** `coval_tracing.py` — a self-contained OpenTelemetry module for Coval
5. **Modifies** your entry point to initialize tracing (original backed up to `.bak`)
6. **Validates** by sending a test span to `api.coval.dev`

## Supported Frameworks

| Framework | Detection | Sim ID Extraction |
|-----------|-----------|-------------------|
| **Pipecat** | `pipecat-ai` in deps | `args.body` dialin settings |
| **LiveKit Agents** | `livekit-agents` in deps | SIP participant attributes |
| **Generic Python** | Any `.py` project | Manual (TODO added) |

## Options

```
npx @coval/wizard [directory] [options]

Options:
  --yes, -y    Skip confirmation prompts (for CI/automation)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `COVAL_API_KEY` | Yes | Your Coval API key (prompted if not set) |
| `WIZARD_LLM_KEY` | No | Anthropic API key for local dev (bypasses Coval proxy) |

## Development

```bash
git clone https://github.com/coval-ai/wizard
cd wizard
npm install
npm run dev -- /path/to/your/agent
```

### Commands

```bash
npm run dev          # Run wizard locally via tsx
npm run build        # Build for distribution
npm run test         # Run tests
npm run lint         # Lint with ESLint
npm run format       # Format with Prettier
npm run check        # Run all checks (typecheck + lint + format + test)
```

### Testing Against a Real Agent

```bash
COVAL_API_KEY=your-key WIZARD_LLM_KEY=sk-ant-... npm run dev -- ../your-agent/
```

## How It Works

The wizard sends your entry point code to Claude with a detailed system prompt containing:

- The complete `coval_tracing.py` reference implementation
- Framework-specific injection rules (where to place imports, setup calls, sim ID extraction)
- Strict output format (JSON with the generated files)

Claude returns the modified entry point and a `coval_tracing.py` tailored to your agent. The wizard shows the diff, asks for confirmation, then writes the files.

## Publishing

Version bumps in `package.json` on `main` trigger automatic npm publish via GitHub Actions.

```bash
# Bump version and push
npm version patch  # or minor, major
git push && git push --tags
```

## License

MIT
