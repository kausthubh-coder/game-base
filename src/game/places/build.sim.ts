// The place system's own places as subjects of the check. Filled in with the pipeline; today there are none.
import type { Subject } from './check.sim.ts';

export function declaredSubjects(_seed: number, _groundAt: (x: number, z: number) => number): Subject[] {
  return [];
}

export function knownNames(): string[] {
  return [];
}
