# @coval/wizard

<img src="covalWizard.png" alt="Coval Wizard" width="200" />

Add [Coval](https://coval.dev) OTel tracing to your AI agent with one command.

The wizard reads your Python agent code, uses an LLM to figure out exactly where to inject tracing, and writes the changes for you — with diffs, backups, and validation.

## Quick Start

```bash
npx @coval/wizard
```

That's it. Run it from your agent's project directory and follow the prompts.

## What It Does

1. **Detects** your Python project and framework (Pipecat, LiveKit Agents, or generic)
2. **Analyzes** your entry point with an LLM (Anthropic, OpenAI, or Gemini) to determine the minimal changes needed
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

```text
npx @coval/wizard [directory] [options]

Options:
  --yes, -y    Skip confirmation prompts (for CI/automation)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `COVAL_API_KEY` | Yes | Your Coval API key (prompted if not set) |
| `WIZARD_LLM_KEY` | No | LLM API key for local dev (bypasses Coval proxy) |
| `WIZARD_LLM_PROVIDER` | No | `anthropic` (default), `openai`, or `gemini` |
| `WIZARD_LLM_MODEL` | No | Override the default model (e.g. `gpt-4o`, `gemini-2.5-flash`) |

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
# Anthropic (default)
COVAL_API_KEY=your-key WIZARD_LLM_KEY=sk-ant-... npm run dev -- ../your-agent/

# OpenAI
COVAL_API_KEY=your-key WIZARD_LLM_KEY=sk-... WIZARD_LLM_PROVIDER=openai npm run dev -- ../your-agent/

# Gemini
COVAL_API_KEY=your-key WIZARD_LLM_KEY=AIza... WIZARD_LLM_PROVIDER=gemini npm run dev -- ../your-agent/
```

## How It Works

The wizard sends your entry point code to the configured LLM with a detailed system prompt containing:

- The complete `coval_tracing.py` reference implementation
- Framework-specific injection rules (where to place imports, setup calls, sim ID extraction)
- Strict output format (JSON with the generated files)

The LLM returns the modified entry point and a `coval_tracing.py` tailored to your agent. The wizard shows the diff, asks for confirmation, then writes the files.

## Publishing

Version bumps in `package.json` on `main` trigger automatic npm publish via GitHub Actions.

```bash
# Bump version and push
npm version patch  # or minor, major
git push && git push --tags
```

## License

MIT
