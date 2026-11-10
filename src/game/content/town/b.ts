import { townNow } from './now.ts';
import type { TownPlan } from './kit.ts';

export function townB(): TownPlan {
  return townNow();
}
