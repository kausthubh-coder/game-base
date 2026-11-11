// The player's own hero in an online world: it moves at once, by the same body rules the server runs, and
// is put right when the server's answer comes.
//
// Every body step the browser plays is noted with how it was steered. Each step of the rules sends the last
// three as one numbered input. A snap names the last input the server used and where the server has the
// body after it. A second body, the ghost, starts from there and plays the inputs the server has not used
// yet, and the steps not sent yet. Where the ghost ends is where the hero is now, by the server's account.
// The caller puts the hero's body there and lets the drawn hero catch up over a tenth of a second
// (`PlayerRig.correct`), so a small disagreement is never seen as a jump.
import type { BodyState } from '../../engine/net/messages.ts';
import { BODY_STEPS } from '../../engine/net/messages.ts';
import type { HeroBody } from '../../features/hero/index.ts';

/** More inputs than this waiting for an answer means the server has stopped answering; the oldest are let go. */
const MAX_PENDING = 120;

export interface Steer {
  moveX: number;
  moveZ: number;
  jump: boolean;
}

interface Pending {
  n: number;
  /** mx, mz and jump (0 or 1) of each body step, as the input carries them. */
  moves: number[];
  /** Where this browser had the feet after them. */
  x: number; y: number; z: number;
}

export interface PredictStats {
  /** Snaps whose answer was compared with what this browser had. */
  answers: number;
  /** The distance between where this browser had the hero after an input and where the server had them after it, in blocks. */
  lastGap: number;
  maxGap: number;
  /** How many answers put the hero more than `snapAt` blocks off, so they were moved there at once. */
  snapped: number;
}

export interface Predictor {
  /** Notes one body step just played. */
  stepped(steer: Steer): void;
  /** The moves of the body steps since the last input, for the input sent now. Empty when there were none. */
  moves(): number[];
  /** An input went out with number `n`, carrying `moves`, and the body is now where it says. */
  sent(n: number, moves: number[], at: { x: number; y: number; z: number }): void;
  /**
   * The server's answer: the last input it used and its body after it. Returns where the body is now by the
   * server's account, in an object that is used again on the next call. Null when the answer is older than
   * one already taken.
   */
  answer(ack: number, you: BodyState): BodyState | null;
  /** Forgets every input, as after a new connection. */
  reset(): void;
  readonly stats: PredictStats;
  /** Inputs sent and not answered yet. */
  readonly waiting: number;
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** The steering of one body step as it goes on the wire, so the hero is moved by exactly what the server is told. */
export function wireSteer(steer: Steer): void {
  steer.moveX = round3(Math.max(-1, Math.min(1, steer.moveX)));
  steer.moveZ = round3(Math.max(-1, Math.min(1, steer.moveZ)));
  // -0 reads back as 0 from JSON.
  if (steer.moveX === 0) steer.moveX = 0;
  if (steer.moveZ === 0) steer.moveZ = 0;
}

/** Puts a body where a snap says. */
export function setBody(body: HeroBody, you: BodyState): void {
  body.x = you.x; body.y = you.y; body.z = you.z;
  body.vx = you.vx; body.vy = you.vy; body.vz = you.vz;
  body.facing = you.facing;
  body.grounded = you.ground;
  body.swimming = you.water;
}

/** `ghost` is a body on the same blocks with the hero's tuning and no event bus: it replays without a sound. */
export function createPredictor(ghost: HeroBody): Predictor {
  const pending: Pending[] = [];
  let partial: number[] = [];
  let lastAck = 0;
  const stats: PredictStats = { answers: 0, lastGap: 0, maxGap: 0, snapped: 0 };
  const steer: Steer = { moveX: 0, moveZ: 0, jump: false };
  const now: BodyState = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, facing: 0, ground: false, water: false };

  function play(moves: readonly number[]): void {
    for (let i = 0; i + 2 < moves.length; i += 3) {
      steer.moveX = moves[i]; steer.moveZ = moves[i + 1]; steer.jump = moves[i + 2] === 1;
      ghost.step(steer);
    }
  }

  return {
    stats,
    get waiting() { return pending.length; },

    stepped(s) {
      partial.push(s.moveX, s.moveZ, s.jump ? 1 : 0);
    },

    moves() {
      // An input carries exactly one step's worth of body steps. A frame that ran late may have played more
      // before the step came round; the oldest go with this input and the rest wait for the next.
      const take = partial.slice(0, BODY_STEPS * 3);
      partial = partial.slice(BODY_STEPS * 3);
      while (take.length < BODY_STEPS * 3) take.push(0, 0, 0);
      return take;
    },

    sent(n, moves, at) {
      pending.push({ n, moves, x: at.x, y: at.y, z: at.z });
      if (pending.length > MAX_PENDING) pending.shift();
    },

    answer(ack, you) {
      if (ack < lastAck) return null;
      lastAck = ack;
      let i = 0;
      while (i < pending.length && pending[i].n < ack) i++;
      const mine = pending[i]?.n === ack ? pending[i] : null;
      if (mine) {
        const gap = Math.hypot(mine.x - you.x, mine.y - you.y, mine.z - you.z);
        stats.answers++;
        stats.lastGap = gap;
        if (gap > stats.maxGap) stats.maxGap = gap;
        i++;
      }
      pending.splice(0, i);
      setBody(ghost, you);
      for (const p of pending) play(p.moves);
      play(partial);
      now.x = ghost.x; now.y = ghost.y; now.z = ghost.z;
      now.vx = ghost.vx; now.vy = ghost.vy; now.vz = ghost.vz;
      now.facing = ghost.facing; now.ground = ghost.grounded; now.water = ghost.swimming;
      return now;
    },

    reset() {
      pending.length = 0;
      partial = [];
      lastAck = 0;
    },
  };
}
