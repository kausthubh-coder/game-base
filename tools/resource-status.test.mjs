import { expect, test } from 'bun:test';
import * as resources from './resource-status.mjs';
const { assess, parseTop, parseVmStat, canStartHeavy } = resources;

test('uses the latest interval rather than boot-time swap totals', () => {
  expect(parseTop('CPU usage: 40% user, 40% sys, 20% idle\nPhysMem: 14G used, 1G unused.\nVM: 200(2) swapouts.\nCPU usage: 25% user, 30% sys, 45% idle\nPhysMem: 13G used, 2560M unused.\nVM: 200(0) swapouts.')).toEqual({ idle: 45, unusedGiB: 2.5, swapouts: 0 });
});
test('a first job does not require the second-job reserve', () => {
  const result = assess({ idle: 25, unusedGiB: .3, reclaimableGiB: 1.5, pressure: 1, swapouts: 0, diskGiB: 2.5 });
  expect(result.admitFirst).toBe(true);
  expect(result.admitAdditional).toBe(false);
  expect(result.heavyLimit).toBe(1);
});
test('no heavy job is admitted when measurements are missing or unsafe', () => {
  const healthy = { idle: 45, unusedGiB: .3, reclaimableGiB: 2.5, pressure: 1, swapouts: 0, diskGiB: 9 };
  for (const changed of [{ idle: 5 }, { reclaimableGiB: .5 }, { pressure: 0 }, { pressure: 2 }, { pressure: 4 }, { swapouts: 1 }, { diskGiB: 1 }, { idle: NaN }, { reclaimableGiB: undefined }, { diskGiB: NaN }, { reclaimableGiB: Infinity }, { idle: 101 }, { swapouts: -1 }]) {
    const result = assess({ ...healthy, ...changed });
    expect(result.admitFirst).toBe(false);
    expect(result.admitAdditional).toBe(false);
    expect(result.heavyLimit).toBe(0);
  }
});
test('admits a second job only with CPU, memory and disk headroom', () => {
  const healthy = { idle: 45, unusedGiB: .3, reclaimableGiB: 2.5, pressure: 1, swapouts: 0, diskGiB: 9 };
  expect(assess(healthy).admitAdditional).toBe(true);
  for (const changed of [{ idle: 5 }, { reclaimableGiB: .5 }, { pressure: 0 }, { pressure: 2 }, { pressure: 4 }, { swapouts: 1 }, { diskGiB: 1 }])
    expect(assess({ ...healthy, ...changed }).admitAdditional).toBe(false);
});
test('unreadable sampling fails instead of admitting work', () => {
  expect(() => parseTop('no measurements')).toThrow();
});

const vmFixture = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free: 16384.
Pages active: 200000.
Pages inactive: 400000.
Pages speculative: 16384.
Pages purgeable: 16384.
File-backed pages: 131072.
Pages occupied by compressor: 100000.
`;
test('cache-heavy Mac can admit work without counting anonymous inactive or compressed pages', () => {
  expect(assess({ idle: 45, unusedGiB: .25, reclaimableGiB: 2.25, pressure: 1, swapouts: 0, diskGiB: 9 }).admitAdditional).toBe(true);
  const memory = parseVmStat(vmFixture);
  expect(memory).toEqual({ pageSize: 16384, freeGiB: .25, fileBackedGiB: 2, purgeableGiB: .25, reclaimableGiB: 2.25 });
  expect(assess({ idle: 45, unusedGiB: .25, ...memory, pressure: 1, swapouts: 0, diskGiB: 9 }).admitAdditional).toBe(true);
  const noFileCache = parseVmStat(vmFixture.replace('File-backed pages: 131072.', 'File-backed pages: 0.'));
  expect(assess({ idle: 45, unusedGiB: .25, ...noFileCache, pressure: 1, swapouts: 0, diskGiB: 9 }).admitFirst).toBe(false);
});
test('reads page size rather than assuming Intel or Apple silicon', () => {
  expect(parseVmStat(vmFixture.replace('16384 bytes', '4096 bytes')).reclaimableGiB).toBe(.5625);
});
test('malformed memory counters cannot authorize a launch', () => {
  for (const text of [vmFixture.replace('16384 bytes', '0 bytes'), vmFixture.replace('File-backed pages: 131072.', ''), vmFixture.replace('Pages free: 16384.', 'Pages free: -1.')])
    expect(() => parseVmStat(text)).toThrow();
});
test('launch decision distinguishes zero, one and two active machine-wide heavy jobs', () => {
  const firstOnly = assess({ idle: 25, unusedGiB: .3, reclaimableGiB: 1.5, pressure: 1, swapouts: 0, diskGiB: 2.5 });
  expect(canStartHeavy(firstOnly, 0)).toBe(true);
  expect(canStartHeavy(firstOnly, 1)).toBe(false);
  const twoAllowed = assess({ idle: 45, unusedGiB: .3, reclaimableGiB: 2.5, pressure: 1, swapouts: 0, diskGiB: 9 });
  expect(canStartHeavy(twoAllowed, 1)).toBe(true);
  for (const count of [2, 3, -1, NaN, undefined, .5]) expect(canStartHeavy(twoAllowed, count)).toBe(false);
  expect(canStartHeavy({}, 0)).toBe(false);
});

test('first and second admission retain the existing reserve thresholds', () => {
  const first = { idle: 10, reclaimableGiB: 1, pressure: 1, swapouts: 0, diskGiB: 2 };
  expect(assess(first).heavyLimit).toBe(1);
  for (const changed of [{ idle: 9.99 }, { reclaimableGiB: .999 }, { diskGiB: 1.999 }])
    expect(assess({ ...first, ...changed }).heavyLimit).toBe(0);
  const second = { idle: 30, reclaimableGiB: 2, pressure: 1, swapouts: 0, diskGiB: 3 };
  expect(assess(second).heavyLimit).toBe(2);
  for (const changed of [{ idle: 29.99 }, { reclaimableGiB: 1.999 }, { diskGiB: 2.999 }])
    expect(assess({ ...second, ...changed }).heavyLimit).toBe(1);
});
