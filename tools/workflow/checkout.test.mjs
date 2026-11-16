import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claimPort, devEnvIsSafe } from '../lib/checkout.mjs';
import { chromeExecutable } from '../lib/chrome-path.mjs';
import { portForFolder } from '../lib/doctor.mjs';
test('idle worktrees reserve different ports and reruns keep the reservation', async () => {
  const common = mkdtempSync(join(tmpdir(), 'ports-'));
  const main = '/repo', trees = [main, '/a/work', '/b/work'];
  try {
    const paths = { common, main, trees };
    writeFileSync(join(common, 'game-ports.json'), JSON.stringify({ [main]: portForFolder(trees[1]) }));
    const first = await claimPort(trees[1], paths, async () => true);
    expect(first).not.toBe(portForFolder(trees[1]));
    const second = await claimPort(trees[2], paths, async () => true);
    expect(first).not.toBe(second);
    expect(await claimPort(trees[1], paths, async () => true)).toBe(first);
    await expect(claimPort(trees[1], paths, async () => false)).rejects.toThrow('reserved port');
  } finally { rmSync(common, { recursive: true }); }
});
test('setup rejects production values and tokens without printing them', () => {
  expect(devEnvIsSafe('VITE_CONVEX_URL=https://dev.convex.cloud')).toBe(true);
  expect(devEnvIsSafe('VITE_CONVEX_URL=https://rare-lion-700.convex.cloud')).toBe(false);
  expect(devEnvIsSafe('CONVEX_DEPLOY_KEY=prod:secret')).toBe(false);
  expect(devEnvIsSafe('CLOUDFLARE_API_TOKEN=secret')).toBe(false);
});
test('browser selection uses matching cached Chromium on Linux and respects an explicit path', () => {
  const executable = (path) => path === '/cache/chromium';
  expect(chromeExecutable({ platform: 'linux', cached: '/cache/chromium', executable })).toBe('/cache/chromium');
  expect(() => chromeExecutable({ override: '/missing', executable })).toThrow('CHROME_PATH');
});
