import { buildSystemPrompt, buildUserPrompt } from '../prompts.js'

describe('buildSystemPrompt', () => {
  it('includes the coval_tracing.py reference', () => {
    const prompt = buildSystemPrompt('generic')
    expect(prompt).toContain('setup_coval_tracing')
    expect(prompt).toContain('set_simulation_id')
    expect(prompt).toContain('_ContextualCovalExporter')
  })

  it('includes pipecat-specific rules', () => {
    const prompt = buildSystemPrompt('pipecat')
    expect(prompt).toContain('PipelineTask')
    expect(prompt).toContain('on_dialin_connected')
  })

  it('includes livekit-specific rules', () => {
    const prompt = buildSystemPrompt('livekit')
    expect(prompt).toContain('AgentSession')
    expect(prompt).toContain('instrument_session')
    expect(prompt).toContain('sip.h.X-Coval-Simulation-Id')
  })

  it('includes generic rules', () => {
    const prompt = buildSystemPrompt('generic')
    expect(prompt).toContain('module level')
    expect(prompt).toContain('TODO')
  })

  it('specifies JSON output format', () => {
    const prompt = buildSystemPrompt('livekit')
    expect(prompt).toContain('coval_tracing_py')
    expect(prompt).toContain('modified_entry_point')
    expect(prompt).toContain('explanation')
  })
})

describe('buildUserPrompt', () => {
  it('includes framework and file content', () => {
    const prompt = buildUserPrompt({
      framework: 'livekit',
      entryPointPath: 'agent.py',
      entryPointContent: 'import livekit\n',
      additionalFiles: { 'requirements.txt': 'livekit-agents\n' },
    })

    expect(prompt).toContain('livekit')
    expect(prompt).toContain('agent.py')
    expect(prompt).toContain('import livekit')
    expect(prompt).toContain('requirements.txt')
  })

  it('works with no additional files', () => {
    const prompt = buildUserPrompt({
      framework: 'generic',
      entryPointPath: 'main.py',
      entryPointContent: 'print("hi")\n',
      additionalFiles: {},
    })

    expect(prompt).toContain('generic')
    expect(prompt).toContain('main.py')
  })
})
