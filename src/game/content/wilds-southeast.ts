// Lantern Marsh, the river works and the cave hills, dressed from their approved kits (assets-src/concept/region-southeast): the
// models set down there, as `LANDMARKS` and `LANDMARK_SIZES` in greenhollow.ts read them. This file is the
// south-east's own, so its builders never edit the shared lists. Plain numbers and names only: the terrain reads it in
// its worker.

import type { MapPoint } from './greenhollow.ts';

/** The south-east's sites, the shape of an entry of `LANDMARKS` in greenhollow.ts. */
export const SOUTHEAST_SITES: readonly { id: string; model: string; place: string; at?: MapPoint; turn: number; variant?: string; wet?: boolean }[] = [];

/** The sizes of the south-east's own models, the shape of an entry of `LANDMARK_SIZES` in greenhollow.ts. */
export const SOUTHEAST_SIZES: Readonly<Record<string, { w: number; d: number; h: number; walk?: boolean; open?: boolean; back?: number; wet?: boolean; deck?: boolean; dress?: boolean }>> = {};
