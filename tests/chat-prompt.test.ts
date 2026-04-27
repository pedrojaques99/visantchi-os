/**
 * shared/chat-prompt — mascot system prompt builder
 */
import { describe, it, expect } from 'vitest';

async function getShared() {
  return import('../packages/cli/visantchi/packages/shared/dist/index.js');
}

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    agentId: 'test-uuid',
    health: 'stable',
    mood: 'content',
    energy: 'medium',
    satiety: 'satisfied',
    lastComment: '',
    lastCommentAt: new Date(0).toISOString(),
    updatedAt: new Date().toISOString(),
    stance: 'Observation is life.',
    personality: {
      name: 'Hank Nocturne',
      archetype: 'poet',
      seed: 'abc123',
      catchphrase: 'Todo bug tem uma beleza trágica.',
    },
    ...overrides,
  };
}

describe('buildMascotSystemPrompt', () => {
  it('includes mascot name in the prompt', async () => {
    const { buildMascotSystemPrompt } = await getShared();
    const prompt = buildMascotSystemPrompt(makeState());
    expect(prompt).toContain('Hank Nocturne');
  });

  it('includes archetype in the prompt', async () => {
    const { buildMascotSystemPrompt } = await getShared();
    const prompt = buildMascotSystemPrompt(makeState());
    expect(prompt).toContain('poet');
  });

  it('includes catchphrase', async () => {
    const { buildMascotSystemPrompt } = await getShared();
    const prompt = buildMascotSystemPrompt(makeState());
    expect(prompt).toContain('Todo bug tem uma beleza trágica.');
  });

  it('includes stance', async () => {
    const { buildMascotSystemPrompt } = await getShared();
    const prompt = buildMascotSystemPrompt(makeState());
    expect(prompt).toContain('Observation is life.');
  });

  it('injects conversation history when provided', async () => {
    const { buildMascotSystemPrompt } = await getShared();
    const prompt = buildMascotSystemPrompt(makeState(), '[USER] hello\n[YOU] world');
    expect(prompt).toContain('[USER] hello');
    expect(prompt).toContain('[YOU] world');
  });

  it('returns fallback prompt when personality is missing', async () => {
    const { buildMascotSystemPrompt } = await getShared();
    const state = makeState({ personality: undefined });
    const prompt = buildMascotSystemPrompt(state);
    expect(prompt).toContain('Visantchi');
    expect(prompt.length).toBeGreaterThan(10);
  });

  it('includes mood modifier for burnt state', async () => {
    const { buildMascotSystemPrompt } = await getShared();
    const prompt = buildMascotSystemPrompt(makeState({ mood: 'burnt' }));
    expect(prompt).toMatch(/burnt|exaust|patient|shorter/i);
  });

  it('includes energy modifier for exhausted state', async () => {
    const { buildMascotSystemPrompt } = await getShared();
    const prompt = buildMascotSystemPrompt(makeState({ energy: 'exhausted' }));
    expect(prompt).toMatch(/exhausted|minimal|conserv/i);
  });

  it('mentions last comment when present', async () => {
    const { buildMascotSystemPrompt } = await getShared();
    const state = makeState({ lastComment: 'Você está queimando dinheiro.' });
    const prompt = buildMascotSystemPrompt(state);
    expect(prompt).toContain('Você está queimando dinheiro.');
  });

  it('each archetype produces distinct voice directives', async () => {
    const { buildMascotSystemPrompt } = await getShared();
    const archetypes = ['scout', 'poet', 'prophet', 'stoic', 'gadfly', 'analyst', 'fool', 'patriarch'];
    const prompts = archetypes.map(arch =>
      buildMascotSystemPrompt(makeState({
        personality: { name: `Test ${arch}`, archetype: arch, seed: 'x', catchphrase: 'cp' }
      }))
    );
    // Each prompt should be unique
    const unique = new Set(prompts);
    expect(unique.size).toBe(archetypes.length);
  });

  it('veteran relationship context for 100+ sessions', async () => {
    const { buildMascotSystemPrompt } = await getShared();
    const prompt = buildMascotSystemPrompt(makeState(), undefined, 100);
    expect(prompt).toMatch(/veteran|long witness|arc/i);
  });

  it('stranger relationship context for 0 sessions', async () => {
    const { buildMascotSystemPrompt } = await getShared();
    const prompt = buildMascotSystemPrompt(makeState(), undefined, 0);
    expect(prompt).toMatch(/not know|observing|new/i);
  });
});
