import { describe, expect, test } from 'bun:test';
import { createServer } from 'node:net';
import { availablePort, formatResults, portForFolder, portIsFree } from './lib/doctor.mjs';

describe('worktree doctor', () => {
  test('stable ports depend on the folder name and main keeps 5300', () => {
    expect(portForFolder('/tmp/game-a')).toBe(portForFolder('/other/game-a'));
    expect(portForFolder('/tmp/game-a')).not.toBe(portForFolder('/tmp/game-b'));
    for (let i = 0; i < 1000; i++) {
      expect(portForFolder(`/tmp/worktree-${i}`)).toBeGreaterThanOrEqual(5400);
      expect(portForFolder(`/tmp/worktree-${i}`)).toBeLessThanOrEqual(5999);
    }
    expect(portForFolder('/main', true)).toBe(5300);
  });
  test('occupied ports advance, wrap, and fail when exhausted', async () => {
    expect(await availablePort(5999, false, async (port) => port === 5401)).toBe(5401);
    await expect(availablePort(5400, false, async () => false)).rejects.toThrow('no free port');
    await expect(availablePort(5300, true, async () => false)).rejects.toThrow('5300 is occupied');
  });
  test('detects a real listener', async () => {
    const server = createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    try { expect(await portIsFree(port)).toBe(false); }
    finally { await new Promise((resolve) => server.close(resolve)); }
    expect(await portIsFree(port)).toBe(true);
  });
  test('text and JSON preserve statuses, reasons, and the env command', () => {
    const items = [{ item: 'port', status: 'fixed', reason: 'PORT=5401; export PORT=5401 PLAY_PORT=5401', port: 5401 }];
    expect(formatResults(items)).toBe('fixed port: PORT=5401; export PORT=5401 PLAY_PORT=5401');
    expect(JSON.parse(formatResults(items, true))).toEqual(items);
    expect(formatResults([{ item: 'chrome', status: 'FAIL', reason: 'missing executable' }])).toBe('FAIL chrome: missing executable');
  });
});
