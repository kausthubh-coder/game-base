// What /world/<id>/stats answers. It is its own file so the checks can read the shape without the
// Durable Object, which only the Workers runtime can load.
import type { RoomStats } from './room.ts';

export interface Timing {
  count: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface WorldStats extends Partial<RoomStats> {
  worldId: string;
  build: string;
  /** True while the 20-a-second timer runs. */
  stepping: boolean;
  /** True when the rules are in memory. */
  loaded: boolean;
  sockets: number;
  /** Steps this object has run since it woke. */
  stepsRun: number;
  /** Steps that were never run because the timer fell too far behind. */
  stepsLost: number;
  /** Milliseconds of one step of the rules, over the last minute of steps. */
  stepMs: Timing;
  /** Milliseconds to make, encode and send every player's snap after a step. */
  snapMs: Timing;
  messagesIn: number;
  bytesIn: number;
  bytesOut: number;
  saves: number;
  lastSave: { ms: number; rows: number; bytes: number; why: string } | null;
}
