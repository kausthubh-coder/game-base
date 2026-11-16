/** Extra lens height needed to see a grounded body over foreground land. No terrain is cut. */
export function groundCameraRise(
  eye: Readonly<{ x: number; y: number; z: number }>,
  feet: Readonly<{ x: number; y: number; z: number }>,
  heightAt: (x: number, z: number) => number,
): number {
  // Underground and interiors keep their own camera. Never move a lens through a roof.
  const floor = heightAt(feet.x, feet.z);
  if (!Number.isFinite(floor) || Math.abs(floor - feet.y) > 0.25) return 0;
  const dx = eye.x - feet.x, dz = eye.z - feet.z, distance = Math.hypot(dx, dz);
  if (distance < 1) return 0;
  let rise = 0;
  // Include the sides of the billboard. Stay outside the supporting footprint, where the feet
  // naturally meet the slope. Quarter-meter samples cover the one-meter terrain triangles.
  for (let side = -0.25; side <= 0.25; side += 0.25) {
    const x = feet.x + dz / distance * side, z = feet.z - dx / distance * side;
    for (let along = 0.5; along < distance; along += 0.25) {
      const t = along / distance;
      const ground = heightAt(x + (eye.x - x) * t, z + (eye.z - z) * t);
      if (!Number.isFinite(ground)) continue;
      const rayY = feet.y + 0.08 + (eye.y - feet.y - 0.08) * t;
      rise = Math.max(rise, (ground + 0.04 - rayY) / t);
    }
  }
  return Math.max(0, rise);
}
