// Digital keys approximate the requested camera-relative direction over successive samples.
// Carry the fractional demand so a small lateral correction is not discarded forever.
export function createKeyboardSteering() {
 let forward = 0, right = 0;
 return (dx, dz, yaw) => {
  const length = Math.hypot(dx, dz) || 1;
  forward += (-dx * Math.sin(yaw) - dz * Math.cos(yaw)) / length;
  right += (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / length;
  const f = Math.round(forward), r = Math.round(right);
  forward -= f; right -= r;
  return { forward: f, right: r };
 };
}
