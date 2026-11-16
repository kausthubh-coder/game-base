// Advisory admission check for this Mac. Sample before starting another heavy job and during its run.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { statfsSync } from 'node:fs';

const exec = promisify(execFile);
export function assess({ idle, reclaimableGiB, pressure, swapouts, diskGiB }) {
  const valid = [idle, reclaimableGiB, pressure, swapouts, diskGiB].every(Number.isFinite)
    && idle >= 0 && idle <= 100 && reclaimableGiB >= 0 && swapouts >= 0 && diskGiB >= 0;
  if (!valid || pressure !== 1 || swapouts > 0 || diskGiB < 2 || reclaimableGiB < 1 || idle < 10)
    return { heavyLimit: 0, admitFirst: false, admitAdditional: false, reason: 'Hold new heavy work; measurements are missing or a CPU, memory, pressure, swap or disk reserve failed.' };
  if (idle >= 30 && reclaimableGiB >= 2 && diskGiB >= 3)
    return { heavyLimit: 2, admitFirst: true, admitAdditional: true, reason: 'Up to two independent heavy jobs may run; resample during the run.' };
  return { heavyLimit: 1, admitFirst: true, admitAdditional: false, reason: 'One heavy job may run; source work can overlap.' };
}

// The caller must know the machine-wide active count. This probe does not reserve a slot.
export function canStartHeavy(status, activeHeavyJobs) {
  if (!Number.isInteger(activeHeavyJobs) || activeHeavyJobs < 0 || activeHeavyJobs >= 2) return false;
  return (activeHeavyJobs === 0 ? status?.admitFirst : status?.admitAdditional) === true;
}

export function parseVmStat(text) {
  const pageSize = Number(text.match(/page size of (\d+) bytes/)?.[1]);
  const pages = (label) => Number(text.match(new RegExp('^' + label + ':\\s+(\\d+)\\.\\s*$', 'm'))?.[1]);
  const free = pages('Pages free');
  const fileBacked = pages('File-backed pages');
  const purgeable = pages('Pages purgeable');
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0 || ![free, fileBacked, purgeable].every((v) => Number.isSafeInteger(v) && v >= 0))
    throw new Error('Could not read VM page size, free, file-backed or purgeable memory');
  const gib = (count) => count * pageSize / 1024 ** 3;
  // File-backed pages are reclaimable cache, not guaranteed immediately free bytes.
  // Exclude anonymous inactive, compressed and purgeable pages. Do not add speculative
  // pages, which overlap the file-backed count. Keep top unused as separate evidence.
  return { pageSize, freeGiB: gib(free), fileBackedGiB: gib(fileBacked), purgeableGiB: gib(purgeable), reclaimableGiB: gib(free + fileBacked) };
}

export function parseTop(text) {
  const last = (pattern) => [...text.matchAll(pattern)].at(-1)?.[1];
  const idle = Number(last(/CPU usage:.*?([\d.]+)% idle/g));
  const memory = [...text.matchAll(/PhysMem:.*?([\d.]+)([MG]) unused/g)].at(-1);
  const swapouts = Number(last(/\((\d+)\) swapouts/g));
  const unusedGiB = memory ? Number(memory[1]) / (memory[2] === 'M' ? 1024 : 1) : NaN;
  if (![idle, unusedGiB, swapouts].every(Number.isFinite)) throw new Error('Could not read CPU, unused memory or swap activity');
  return { idle, unusedGiB, swapouts };
}

export async function sample() {
  const [top, pressure, vm] = await Promise.all([
    exec('top', ['-l', '2', '-s', '1', '-n', '0'], { timeout: 15000 }),
    exec('sysctl', ['-n', 'kern.memorystatus_vm_pressure_level'], { timeout: 5000 }),
    exec('vm_stat', [], { timeout: 5000 }),
  ]);
  const fs = statfsSync(process.cwd());
  const values = { ...parseTop(top.stdout), ...parseVmStat(vm.stdout), pressure: Number(pressure.stdout.trim()), diskGiB: fs.bavail * fs.bsize / 1024 ** 3 };
  return { at: new Date().toISOString(), ...values, ...assess(values) };
}

if (import.meta.main) {
  try { console.log(JSON.stringify(await sample())); }
  catch (error) { console.error(String(error)); process.exitCode = 1; }
}
