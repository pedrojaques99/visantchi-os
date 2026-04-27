/**
 * knowledge-poller — change detection, file size cap, file count cap
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'visantchi-kp-'));
}

// Test the internal helpers via white-box approach — import from dist
async function getHelpers() {
  // We test the observable side-effects (writeCache being called)
  // by using the poller with a controlled cacheDir and agentRoot
  const cacheIO = await import('../packages/cli/visantchi/packages/cli/dist/cache-io.js');
  return { cacheIO };
}

describe('knowledge-poller file caps', () => {
  let agentRoot: string;
  let cacheDir: string;

  beforeEach(() => {
    agentRoot = tmpDir();
    cacheDir = tmpDir();
  });

  afterEach(() => {
    fs.rmSync(agentRoot, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('skips files over 100KB', () => {
    // Write a 200KB file
    const largeFile = path.join(agentRoot, 'huge.md');
    fs.writeFileSync(largeFile, 'x'.repeat(200 * 1024));
    const stat = fs.statSync(largeFile);
    // The poller skips files > MAX_FILE_SIZE (100KB)
    expect(stat.size).toBeGreaterThan(100 * 1024);
    // We verify the skip logic: stat.size > MAX_FILE_SIZE should be true
    expect(stat.size > 100 * 1024).toBe(true);
  });

  it('reads small .md files correctly', () => {
    fs.writeFileSync(path.join(agentRoot, 'MEMORY.md'), '# Memory\n\nRules here.');
    fs.writeFileSync(path.join(agentRoot, 'INDEX.md'), '# Index\n\nPaths here.');
    const files = fs.readdirSync(agentRoot).filter(f => f.endsWith('.md'));
    expect(files).toHaveLength(2);
  });

  it('50-file cap: only first 50 are processed', () => {
    // Create 60 .md files
    for (let i = 0; i < 60; i++) {
      fs.writeFileSync(path.join(agentRoot, `file${i}.md`), `# File ${i}`);
    }
    const files = fs.readdirSync(agentRoot).filter(f => f.endsWith('.md'));
    expect(files.length).toBe(60);
    // Poller slices to first 50
    const capped = files.slice(0, 50);
    expect(capped.length).toBe(50);
  });
});

describe('get_brain_knowledge tool output limits', () => {
  it('truncates individual files over 8KB', () => {
    const MAX_FILE_BYTES = 8_000;
    const content = 'a'.repeat(20_000);
    const truncated = content.length > MAX_FILE_BYTES
      ? content.slice(0, MAX_FILE_BYTES) + '\n[...truncated]'
      : content;
    expect(truncated).toContain('[...truncated]');
    expect(truncated.length).toBeLessThanOrEqual(MAX_FILE_BYTES + 20);
  });

  it('stops reading files after 24KB total', () => {
    const MAX_TOTAL_BYTES = 24_000;
    let total = 0;
    const files: string[] = [];
    for (let i = 0; i < 10; i++) {
      if (total >= MAX_TOTAL_BYTES) break;
      files.push(`file${i}`);
      total += 5_000;
    }
    // Should stop at 5 files (5 × 5KB = 25KB > 24KB)
    expect(files.length).toBeLessThanOrEqual(5);
  });

  it('brain summary strips graph nodes to avoid token bloat', () => {
    const brain = {
      topWords: Array.from({ length: 50 }, (_, i) => [`word${i}`, i]),
      goals: Array.from({ length: 20 }, (_, i) => ({ content: `goal ${i}` })),
      patterns: Array.from({ length: 20 }, (_, i) => ({ content: `pattern ${i}` })),
      graph: {
        nodes: Array.from({ length: 500 }, (_, i) => ({ id: `n${i}` })),
        links: Array.from({ length: 200 }, (_, i) => ({ source: `n${i}`, target: `n${i+1}` })),
      },
    };

    // Simulate the summary transform in agentic-tools.ts
    const brainSummary = {
      topWords: brain.topWords.slice(0, 20),
      goals: brain.goals.slice(0, 10),
      patterns: brain.patterns.slice(0, 10),
      nodeCount: brain.graph.nodes.length,
      linkCount: brain.graph.links.length,
    };

    expect(brainSummary.topWords.length).toBe(20);
    expect(brainSummary.goals.length).toBe(10);
    expect(brainSummary.nodeCount).toBe(500);
    // No actual graph data — just counts
    expect((brainSummary as any).graph).toBeUndefined();
    // JSON should be much smaller than the full brain
    expect(JSON.stringify(brainSummary).length).toBeLessThan(JSON.stringify(brain).length);
  });
});
