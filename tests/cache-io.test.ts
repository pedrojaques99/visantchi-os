/**
 * cache-io — session cap, ledger, archiving, compact JSON
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ── helpers ──────────────────────────────────────────────────────────────────

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'visantchi-test-'));
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    source: 'claude',
    model: 'claude-sonnet-4-6',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    costUSD: 0.01,
    messageCount: 5,
    projectPath: 'test-project',
    gitBranch: 'main',
    keywords: [],
    metadata: {},
    ...overrides,
  };
}

// Dynamically import cache-io from the built CLI package
async function getCacheIO() {
  return import(
    '../packages/cli/visantchi/packages/cli/dist/cache-io.js'
  );
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('writeCache / readCache', () => {
  let dir: string;

  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('writes and reads sessions correctly', async () => {
    const { writeCache, readCache } = await getCacheIO();
    const sessions = [makeSession(), makeSession()];
    writeCache(dir, 'sessions', sessions);
    const result = readCache(dir, 'sessions');
    expect(result).toHaveLength(2);
  });

  it('stamps machineId on sessions that lack it', async () => {
    const { writeCache, readCache } = await getCacheIO();
    writeCache(dir, 'sessions', [makeSession()]);
    const result = readCache(dir, 'sessions');
    expect(result[0].machineId).toBeTruthy();
  });

  it('writes compact JSON (no indentation)', async () => {
    const { writeCache } = await getCacheIO();
    writeCache(dir, 'sessions', [makeSession()]);
    const raw = fs.readFileSync(path.join(dir, 'sessions.json'), 'utf-8');
    expect(raw).not.toContain('\n  '); // no pretty-print indentation
  });

  it('returns null for missing cache key', async () => {
    const { readCache } = await getCacheIO();
    expect(readCache(dir, 'sessions')).toBeNull();
  });

  it('returns null for corrupt cache file', async () => {
    const { readCache } = await getCacheIO();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'sessions.json'), 'NOT_JSON', 'utf-8');
    expect(readCache(dir, 'sessions')).toBeNull();
  });
});

describe('session cap & archiving', () => {
  let dir: string;

  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('keeps at most 500 sessions in active cache', async () => {
    const { writeCache, readCache } = await getCacheIO();
    const sessions = Array.from({ length: 600 }, (_, i) =>
      makeSession({ id: `s${i}`, costUSD: 0.01, totalTokens: 1000 })
    );
    writeCache(dir, 'sessions', sessions);
    const active = readCache(dir, 'sessions');
    expect(active).toHaveLength(500);
  });

  it('keeps the MOST RECENT 500 sessions (not oldest)', async () => {
    const { writeCache, readCache } = await getCacheIO();
    const sessions = Array.from({ length: 510 }, (_, i) =>
      makeSession({ id: `s${i}`, startedAt: new Date(Date.now() + i * 1000).toISOString() })
    );
    writeCache(dir, 'sessions', sessions);
    const active = readCache(dir, 'sessions');
    // Last session should be the 510th (index 509)
    expect(active[active.length - 1].id).toBe('s509');
    // First active session should be the 11th (index 10)
    expect(active[0].id).toBe('s10');
  });

  it('archives overflow sessions to JSONL', async () => {
    const { writeCache } = await getCacheIO();
    const sessions = Array.from({ length: 550 }, (_, i) =>
      makeSession({ id: `s${i}` })
    );
    writeCache(dir, 'sessions', sessions);

    const archiveDir = path.join(dir, 'archive');
    expect(fs.existsSync(archiveDir)).toBe(true);
    const files = fs.readdirSync(archiveDir).filter(f => f.endsWith('.jsonl'));
    expect(files.length).toBeGreaterThan(0);

    const lines = fs.readFileSync(path.join(archiveDir, files[0]), 'utf-8')
      .split('\n').filter(Boolean);
    expect(lines.length).toBe(50); // 550 - 500 = 50 archived
  });

  it('no archiving when sessions <= 500', async () => {
    const { writeCache } = await getCacheIO();
    writeCache(dir, 'sessions', Array.from({ length: 100 }, () => makeSession()));
    expect(fs.existsSync(path.join(dir, 'archive'))).toBe(false);
  });
});

describe('metrics ledger', () => {
  let dir: string;

  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('returns zero ledger when no file exists', async () => {
    const { readMetricsLedger } = await getCacheIO();
    const ledger = readMetricsLedger(dir);
    expect(ledger.totalSessions).toBe(0);
    expect(ledger.totalTokens).toBe(0);
    expect(ledger.archivedSessions).toBe(0);
  });

  it('accumulates archived session totals in ledger', async () => {
    const { writeCache, readMetricsLedger } = await getCacheIO();
    const sessions = Array.from({ length: 550 }, (_, i) =>
      makeSession({ id: `s${i}`, totalTokens: 1000, costUSD: 0.01 })
    );
    writeCache(dir, 'sessions', sessions);

    const ledger = readMetricsLedger(dir);
    expect(ledger.archivedSessions).toBe(50);
    expect(ledger.totalTokens).toBe(50 * 1000); // 50 archived × 1000 tokens
    expect(ledger.totalCostUSD).toBeCloseTo(50 * 0.01, 5);
  });

  it('ledger totalSessions reflects full count including archived', async () => {
    const { writeCache, readMetricsLedger } = await getCacheIO();
    writeCache(dir, 'sessions', Array.from({ length: 600 }, () => makeSession()));
    const ledger = readMetricsLedger(dir);
    expect(ledger.totalSessions).toBe(600);
  });

  it('ledger survives multiple cap events (additive)', async () => {
    const { writeCache, readMetricsLedger } = await getCacheIO();
    // First batch: 550 → archives 50
    writeCache(dir, 'sessions', Array.from({ length: 550 }, () => makeSession({ totalTokens: 1000, costUSD: 0.01 })));
    // Second batch: 550 again → archives another 50
    writeCache(dir, 'sessions', Array.from({ length: 550 }, () => makeSession({ totalTokens: 2000, costUSD: 0.02 })));

    const ledger = readMetricsLedger(dir);
    expect(ledger.archivedSessions).toBe(100);
    expect(ledger.totalTokens).toBe(50 * 1000 + 50 * 2000); // both batches
  });
});
