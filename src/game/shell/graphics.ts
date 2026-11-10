/** Overrides survive quality changes. Null means use the preset. */
export interface Graphics {
  shadows: 'preset' | 'off' | 'soft' | 'sharp';
  shadowDistance: number | null;
  plantDensity: number | null;
  viewDistance: number | null;
  bloom: boolean | null;
  cloudShadows: boolean | null;
  weatherParticles: boolean | null;
  reduceMotion: boolean;
}
export const DEFAULT_GRAPHICS: Graphics = { shadows: 'preset', shadowDistance: null, plantDensity: null, viewDistance: null, bloom: null, cloudShadows: null, weatherParticles: null, reduceMotion: false };
export function readGraphics(raw: unknown): Graphics {
  const g = { ...DEFAULT_GRAPHICS };
  if (!raw || typeof raw !== 'object') return g;
  const r = raw as Record<string, unknown>;
  if (['preset','off','soft','sharp'].includes(String(r.shadows))) g.shadows = r.shadows as Graphics['shadows'];
  for (const key of ['bloom','cloudShadows','weatherParticles','reduceMotion'] as const) if (typeof r[key] === 'boolean') g[key] = r[key];
  for (const [key,min,max] of [['shadowDistance',20,90],['plantDensity',0,1],['viewDistance',.5,1.5]] as const) if (typeof r[key] === 'number' && Number.isFinite(r[key])) g[key] = Math.max(min,Math.min(max,r[key]));
  return g;
}
