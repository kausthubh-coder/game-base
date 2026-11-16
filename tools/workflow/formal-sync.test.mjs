import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkFormalSync } from './formal-sync.mjs';

test('a passing old proof cannot hide edits to covered code', () => {
  const root = mkdtempSync(join(tmpdir(), 'formal-sync-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    git('init', '-q'); mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/rule.ts'), 'export const valid = true;\n');
    git('add', '.'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'baseline');
    const coverage = { commit: git('rev-parse', 'HEAD'), paths: ['src/rule.ts'] };
    expect(() => checkFormalSync(root, coverage)).not.toThrow();
    writeFileSync(join(root, 'unrelated.md'), 'unrelated');
    expect(() => checkFormalSync(root, coverage)).not.toThrow();
    writeFileSync(join(root, 'src/rule.ts'), 'export const valid = false;\n');
    expect(() => checkFormalSync(root, coverage)).toThrow('src/rule.ts');
    git('add', '.'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'change rule');
    expect(() => checkFormalSync(root, coverage)).toThrow('sync review');
    coverage.commit = git('rev-parse', 'HEAD');
    expect(() => checkFormalSync(root, coverage)).not.toThrow();
  } finally { rmSync(root, { recursive: true }); }
});
