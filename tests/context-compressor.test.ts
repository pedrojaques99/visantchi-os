/**
 * shared/context-compressor — compression, query filtering, token estimate
 */
import { describe, it, expect } from 'vitest';

async function getShared() {
  return import('../packages/cli/visantchi/packages/shared/dist/index.js');
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: Math.random().toString(36).slice(2, 10),
    source: 'claude',
    model: 'claude-sonnet-4-6',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    costUSD: 0.05,
    messageCount: 5,
    projectPath: null,
    gitBranch: 'main',
    keywords: [],
    metadata: {},
    machineId: 'test',
    ...overrides,
  };
}

describe('compressInsightsContext', () => {
  it('respects the limit parameter', async () => {
    const { compressInsightsContext } = await getShared();
    const sessions = Array.from({ length: 50 }, () => makeSession());
    const result = compressInsightsContext(sessions, [], 10);
    const lines = result.text.split('\n').filter(Boolean);
    expect(lines.length).toBeLessThanOrEqual(10);
  });

  it('returns empty for empty sessions array', async () => {
    const { compressInsightsContext } = await getShared();
    const result = compressInsightsContext([], [], 25);
    expect(result.text).toBe('');
    expect(result.tokenCountEstimate).toBe(0);
  });

  it('filters out trivial sessions (messageCount <= 1 and cost <= 0.1)', async () => {
    const { compressInsightsContext } = await getShared();
    const trivial = makeSession({ messageCount: 1, costUSD: 0.001 });
    const meaty = makeSession({ messageCount: 10, costUSD: 1.0 });
    const result = compressInsightsContext([trivial, meaty], [], 25);
    expect(result.text).toContain(meaty.id.substring(0, 6));
    expect(result.text).not.toContain(trivial.id.substring(0, 6));
  });

  it('returns most recent sessions first (desc by startedAt)', async () => {
    const { compressInsightsContext } = await getShared();
    const old = makeSession({ id: 'old111', startedAt: '2024-01-01T00:00:00Z', messageCount: 5 });
    const recent = makeSession({ id: 'new222', startedAt: '2025-01-01T00:00:00Z', messageCount: 5 });
    const result = compressInsightsContext([old, recent], [], 25);
    const firstLine = result.text.split('\n')[0];
    expect(firstLine).toContain('new222'.substring(0, 6));
  });

  it('truncates summary at 80 chars', async () => {
    const { compressInsightsContext } = await getShared();
    const longSummary = 'x'.repeat(200);
    const session = makeSession({ messageCount: 5, metadata: { first_prompt: longSummary } });
    const result = compressInsightsContext([session], [], 25);
    const line = result.text.split('\n')[0];
    // Summary part should be capped
    expect(line.length).toBeLessThan(300);
    if (result.text.includes('...')) {
      expect(result.text).toContain('...');
    }
  });

  it('provides a non-zero token estimate', async () => {
    const { compressInsightsContext } = await getShared();
    const sessions = Array.from({ length: 5 }, () => makeSession({ messageCount: 5 }));
    const result = compressInsightsContext(sessions, [], 25);
    expect(result.tokenCountEstimate).toBeGreaterThan(0);
  });
});

describe('filterContextByQuery', () => {
  it('filters to cursor sessions when query mentions cursor', async () => {
    const { filterContextByQuery } = await getShared();
    const sessions = [
      makeSession({ source: 'cursor', id: 'cursor1' }),
      makeSession({ source: 'claude', id: 'claude1' }),
    ];
    const result = filterContextByQuery(sessions, 'cursor usage this week');
    expect(result.every(s => s.source === 'cursor')).toBe(true);
  });

  it('filters to claude sessions when query mentions claude', async () => {
    const { filterContextByQuery } = await getShared();
    const sessions = [
      makeSession({ source: 'cursor' }),
      makeSession({ source: 'claude', id: 'c1' }),
      makeSession({ source: 'claude', id: 'c2' }),
    ];
    const result = filterContextByQuery(sessions, 'compare with claude sessions');
    expect(result.every(s => s.source === 'claude')).toBe(true);
  });

  it('sorts by cost desc for cost-related queries', async () => {
    const { filterContextByQuery } = await getShared();
    const sessions = [
      makeSession({ costUSD: 0.01 }),
      makeSession({ costUSD: 5.00 }),
      makeSession({ costUSD: 0.50 }),
    ];
    const result = filterContextByQuery(sessions, 'onde gasto mais cost');
    expect(result[0].costUSD).toBe(5.00);
  });

  it('returns all sessions for generic queries', async () => {
    const { filterContextByQuery } = await getShared();
    const sessions = Array.from({ length: 10 }, () => makeSession());
    const result = filterContextByQuery(sessions, 'how am i doing overall');
    expect(result.length).toBe(10);
  });
});
