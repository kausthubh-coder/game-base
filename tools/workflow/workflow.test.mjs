import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createChapterRun, CHAPTER_EVIDENCE } from './chapter.mjs';
import { installReplayDriver } from './replay.mjs';

const checks = (pass = true) => ['rules', 'presentation', 'budgets'].map((name) => ({ name, run: async () => pass }));
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'chapter-'));
  const save = join(dir, 'start.json'); writeFileSync(save, '{"keystone":1}');
  const earned = join(dir, 'earned.json'); writeFileSync(earned, '{"keystone":2}');
  const run = createChapterRun({ id: 'pump', revision: 'abc', out: dir, checkpoint: save, requirements: ['state', 'continue'] });
  return { dir, save, earned, run, report: () => JSON.parse(readFileSync(run.path, 'utf8')) };
}
test('a framing failure stops replay and preserves the earned checkpoint and failed report', async () => {
  const f = fixture();
  try {
    await expect(f.run.preflight(checks(false))).rejects.toThrow('preflight failed');
    let played = false;
    await expect(f.run.step('fight', () => { played = true; }, () => true)).rejects.toThrow('pass preflight');
    expect(played).toBe(false); expect(f.report().status).toBe('failed');
    expect(readFileSync(f.save, 'utf8')).toBe('{"keystone":1}');
  } finally { rmSync(f.dir, { recursive: true }); }
});
test('omitting presentation cannot pass preflight', async () => {
  const f = fixture();
  try { await expect(f.run.preflight([checks()[0]])).rejects.toThrow('presentation'); }
  finally { rmSync(f.dir, { recursive: true }); }
});
test('acceptance requires a replay and unchanged evidence for every requirement', async () => {
  const f = fixture();
  try {
    await f.run.preflight(checks());
    await f.run.step('keystone', () => 2, (value) => value === 2);
    f.run.evidence('state', f.save);
    expect(() => f.run.accept()).toThrow('earned-save');
    expect(f.report().status).toBe('failed');
  } finally { rmSync(f.dir, { recursive: true }); }
});
test('a completed attempt keeps a checkpoint hash and accepts only after verified steps and evidence', async () => {
  const f = fixture();
  try {
    await f.run.preflight(checks());
    await f.run.step('keystone', () => 2, (value) => value === 2);
    for (const name of CHAPTER_EVIDENCE) f.run.evidence(name, f.earned);
    expect(f.run.accept()).toBe(f.run.path);
    expect(f.report().status).toBe('accepted'); expect(f.report().input.sha256).toHaveLength(64);
  } finally { rmSync(f.dir, { recursive: true }); }
});
test('a failed replay is recorded and cannot be accepted', async () => {
  const f = fixture();
  try {
    await f.run.preflight(checks());
    await expect(f.run.step('fight', () => 'lost', (result) => result === 'won')).rejects.toThrow('fight');
    expect(f.report().steps).toEqual([{ name: 'fight', pass: false }]);
    expect(() => f.run.accept()).toThrow('no successful earned replay');
  } finally { rmSync(f.dir, { recursive: true }); }
});
test('changing the input checkpoint or recorded evidence invalidates acceptance', async () => {
  const f = fixture();
  try {
    await f.run.preflight(checks()); await f.run.step('fight', () => true, (v) => v);
    for (const name of CHAPTER_EVIDENCE) f.run.evidence(name, f.earned);
    writeFileSync(f.save, 'edited');
    expect(() => f.run.accept()).toThrow('starting checkpoint changed');
  } finally { rmSync(f.dir, { recursive: true }); }
});
test('replay cannot reach a target on another floor or interact out of authored reach', () => {
  const keys = new Map();
  const pos = { x: 0, y: 2, z: 0 };
  const previous = globalThis.window;
  globalThis.window = { __game: { view: { game: { player: { pos }, systems: { nav: { toward: () => [] } } }, camera: { yaw: 0 } }, key: (k, down = true) => keys.set(k, down), advance: () => {} } };
  try {
    const driver = installReplayDriver();
    expect(driver.walk({ x: 0, y: 10, z: 0 }, { seconds: 0.2 }).ok).toBe(false);
    let pressed = false;
    expect(() => driver.act({ x: 0, y: 10, z: 0 }, { reach: 2, aim: () => {}, press: () => { pressed = true; }, done: () => true })).toThrow('out of reach');
    expect(pressed).toBe(false);
    let aimed;
    const target = { x: 1, y: 2, z: 0 };
    driver.act(target, { reach: 2, aim: (value) => { aimed = value; }, press: () => { pressed = true; }, done: () => pressed });
    expect(aimed).toBe(target); expect(pressed).toBe(true);
    expect([...keys.values()].every((v) => !v)).toBe(true);
  } finally { globalThis.window = previous; }
});
