/**
 * mascote/memory — chat memory JSONL: append, read, format, prune
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'visantchi-mem-'));
}

async function getMem() {
  return import('../packages/cli/visantchi/packages/cli/dist/mascote/memory.js');
}

describe('appendMessage / getRecentMessages', () => {
  let dir: string;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('appends a message and reads it back', async () => {
    const { appendMessage, getRecentMessages } = await getMem();
    appendMessage(dir, { session: 's1', role: 'user', content: 'hello' });
    const msgs = getRecentMessages(dir);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('hello');
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].ts).toBeTruthy();
  });

  it('respects the limit parameter', async () => {
    const { appendMessage, getRecentMessages } = await getMem();
    for (let i = 0; i < 30; i++) {
      appendMessage(dir, { session: 's1', role: 'user', content: `msg ${i}` });
    }
    const msgs = getRecentMessages(dir, 10);
    expect(msgs).toHaveLength(10);
    expect(msgs[msgs.length - 1].content).toBe('msg 29'); // most recent last
  });

  it('returns empty array when file does not exist', async () => {
    const { getRecentMessages } = await getMem();
    expect(getRecentMessages(dir)).toEqual([]);
  });

  it('skips corrupt JSONL lines gracefully', async () => {
    const { getRecentMessages } = await getMem();
    const file = path.join(dir, 'chat-memory.jsonl');
    fs.writeFileSync(file, 'CORRUPT\n{"ts":"2025-01-01T00:00:00Z","session":"s","role":"user","content":"ok"}\n');
    const msgs = getRecentMessages(dir);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('ok');
  });
});

describe('formatMemoryForPrompt', () => {
  it('formats messages as [USER]/[YOU] prefixed lines', async () => {
    const { formatMemoryForPrompt } = await getMem();
    const msgs = [
      { ts: '', session: '', role: 'user' as const, content: 'hi' },
      { ts: '', session: '', role: 'mascot' as const, content: 'hello' },
    ];
    const out = formatMemoryForPrompt(msgs);
    expect(out).toContain('[USER] hi');
    expect(out).toContain('[YOU] hello');
  });

  it('returns empty string for empty array', async () => {
    const { formatMemoryForPrompt } = await getMem();
    expect(formatMemoryForPrompt([])).toBe('');
  });

  it('trims from oldest end when exceeding 3000 chars', async () => {
    const { formatMemoryForPrompt } = await getMem();
    const long = 'x'.repeat(200);
    const msgs = Array.from({ length: 20 }, (_, i) => ({
      ts: '', session: '', role: 'user' as const, content: `${i}: ${long}`,
    }));
    const out = formatMemoryForPrompt(msgs);
    expect(out.length).toBeLessThanOrEqual(3100); // within cap + small overhead
    expect(out).toContain('19:'); // most recent message is always included
  });
});

describe('pruneOldMessages', () => {
  let dir: string;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('does not prune when file is small (<50KB)', async () => {
    const { appendMessage, pruneOldMessages, getRecentMessages } = await getMem();
    appendMessage(dir, { session: 's', role: 'user', content: 'keep me' });
    pruneOldMessages(dir);
    // pruneOldMessages is async (setImmediate) — give it a tick
    await new Promise(r => setImmediate(r));
    expect(getRecentMessages(dir)).toHaveLength(1);
  });

  it('no-ops gracefully when file does not exist', async () => {
    const { pruneOldMessages } = await getMem();
    expect(() => pruneOldMessages(dir)).not.toThrow();
  });
});
