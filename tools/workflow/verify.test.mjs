import { test, expect } from 'bun:test';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executePart } from './verify.mjs';

test('a failed browser replay still stops its server before later verification', () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-cleanup-'));
  try {
    const result = executePart({ run: [[process.execPath, '-e', 'require("node:fs").writeFileSync("server", "running"); process.exit(1)']], onFailure: [[process.execPath, '-e', 'require("node:fs").unlinkSync("server")']] }, root);
    expect(result.result).toBe('FAIL'); expect(existsSync(join(root, 'server'))).toBe(false);
  } finally { rmSync(root, { recursive: true }); }
});

test('successful verification does not stop an already closed session again', () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-success-'));
  try {
    const result = executePart({ run: [[process.execPath, '-e', 'process.exit(0)']], onFailure: [[process.execPath, '-e', 'require("node:fs").writeFileSync("unexpected-stop", "called")']] }, root);
    expect(result.result).toBe('pass'); expect(existsSync(join(root, 'unexpected-stop'))).toBe(false);
  } finally { rmSync(root, { recursive: true }); }
});
