import { treeSounds } from '../../content/tree-sounds.ts';
/** Size adds weight gently, with a cap so a huge tree never turns into an explosion. */
export function treeSoundScale(logs: number): number {
  return 1 + Math.min(treeSounds.maxExtraLogs, Math.max(0, logs - 1)) * treeSounds.logGain;
}
