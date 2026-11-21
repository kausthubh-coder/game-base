// Paint the posed stack with each character's own animation cels. The rig supplies the depth
// of the arms, boots and tool. The original drawing supplies their outline and timing.
import sharp from 'sharp';

export async function loadCharacterPaint(source) {
  const { data, info } = await sharp('public/assets/' + source.sheet)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [w, h] = source.frame;
  return (action, frame, heading, layers, scale, anchor) => {
    const anim = source.animations[action];
    const back = heading >= 3 && heading <= 5;
    const side = heading === 2 || heading === 6;
    const row = anim.rows[side ? 'side' : back ? 'back' : 'front'] ?? anim.rows.front;
    const left = heading > 4;
    const cel = Buffer.alloc(w * h * 4);
    const read = (x, y) => 4 * ((row * h + y) * info.width + frame * w + x);
    if (heading % 2 === 0) {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const src = read(side && left ? w - 1 - x : x, y);
          data.copy(cel, (y * w + x) * 4, src, src + 4);
        }
      return cel;
    }

    // For each height, fit the rig's front-to-back depths to the artist's outline.
    // A continuous segment between adjacent painted texels prevents holes as the slice turns.
    const zBuffer = new Float32Array(w * h).fill(-Infinity);
    // The painted front already faces slightly right. Turn it the rest of the way.
    const co = Math.cos(Math.PI / 6),
      si = (back ? -1 : 1) * Math.sin(Math.PI / 6);
    const relief = new Float32Array(w * h);
    const painted = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      let first = w,
        last = -1;
      for (let x = 0; x < w; x++)
        if (data[read(x, y) + 3] > 127) {
          first = Math.min(first, x);
          last = x;
        }
      if (last < first) continue;
      const layerY = Math.round(((anchor[1] - y) * scale) / (h * 0.84));
      const slice = layers?.get(layerY);
      let minX = Infinity,
        maxX = -Infinity;
      const depths = new Map();
      if (slice)
        for (const voxel of slice.values()) {
          const x = back ? -voxel.x : voxel.x,
            z = back ? -voxel.z : voxel.z;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          depths.set(x, Math.max(z, depths.get(x) ?? -Infinity));
        }
      const width = last - first + 1;
      // Without a rig, the matching painted profile supplies the depth of this slice.
      let volume = width * 0.34;
      if (!layers && anim.rows.side !== undefined) {
        const start = 4 * ((anim.rows.side * h + y) * info.width + frame * w);
        let nose = w - 1, rear = 0;
        while (rear <= nose && data[start + rear * 4 + 3] < 128) rear++;
        while (nose >= rear && data[start + nose * 4 + 3] < 128) nose--;
        if (nose >= rear) volume = Math.min(width * .7, (nose - rear + 1) * .4);
      }
      for (let x = first; x <= last; x++) {
        const src = read(x, y);
        if (data[src + 3] < 128) continue;
        const t = (x - first + 0.5) / width;
        const rigX = Math.round(minX + t * (maxX - minX));
        const near = depths.get(rigX);
        const round = Math.sqrt(4 * t * (1 - t));
        // Round the painted fringe and soften hard triangle edges in the face. Boots
        // and sleeves keep more of the posed rig's travel through the step.
        const rigWeight = near === undefined ? 0 : y < h * 0.45 ? 0.18 : 0.55;
        relief[y * w + x] = (near ?? 0) * rigWeight + volume * round * (1 - rigWeight);
        painted[y * w + x] = 1;
      }
    }

    // Smooth depth only. Every coloured output texel comes straight from a painted cel.
    // This removes voxel stair-steps along the cheeks and the cuffs during a turn.
    for (let y = 0; y < h; y++) {
      let previous = null;
      for (let x = 0; x < w; x++) {
        const pixel = y * w + x;
        if (!painted[pixel]) {
          previous = null;
          continue;
        }
        let depth = 0,
          mass = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const i = pixel + dy * w + dx;
            if (!painted[i]) continue;
            const weight = (3 - Math.abs(dx)) * (3 - Math.abs(dy));
            depth += relief[i] * weight;
            mass += weight;
          }
        const z = depth / mass;
        const src = read(x, y);
        const center = anchor[0] + (x - anchor[0]) * co + (z - 4) * si;
        const d = z * co - (x - anchor[0]) * si;
        const px = Math.round(center);
        const gap = previous === null ? 0 : Math.max(0, Math.abs(px - previous) - 1);
        for (let n = 0; n <= gap; n++) {
          const sx = px + n * Math.sign((previous ?? px) - px);
          const u = left ? w - 1 - sx : sx;
          if (u < 0 || u >= w) continue;
          const p = y * w + u;
          if (d <= zBuffer[p]) continue;
          zBuffer[p] = d;
          data.copy(cel, 4 * p, src, src + 4);
        }
        previous = px;
      }
    }
    return cel;
  };
}
