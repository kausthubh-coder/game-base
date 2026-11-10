// The demo's own sun and sky color. Another feature will own the real sky and lights, so the world
// feature has none: this is only enough light to look at blocks by day and by night.
import * as THREE from 'three';
import type { Quality } from '../../src/engine/types.ts';

export interface DemoSky {
  /** `timeOfDay` is 0 to 1 with noon at 0.5. `focus` is what the shadow follows, `distance` how far the camera is. */
  update(timeOfDay: number, fog: number, focus: { x: number; y: number; z: number }, distance: number): void;
  setQuality(quality: Quality): void;
}

const NIGHT = new THREE.Color(0x0c1230), DAY = new THREE.Color(0x8fc9f2), DUSK = new THREE.Color(0xf0a070);
const WHITE = new THREE.Color(0xffffff);
const SUN_LOW = new THREE.Color(0xffc890), SUN_HIGH = new THREE.Color(0xfff2dc), MOON = new THREE.Color(0x8fa6ff);
const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createDemoSky(scene: THREE.Scene, renderer: THREE.WebGLRenderer): DemoSky {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a5a48, 1);
  scene.add(sun, sun.target, hemi);
  const sky = new THREE.Color();
  scene.background = sky;
  const fog = new THREE.Fog(0xffffff, 100, 300);
  scene.fog = fog;

  const dir = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), center = new THREE.Vector3();

  return {
    update(timeOfDay, fogAmount, focus, distance) {
      const height = Math.sin((timeOfDay - 0.25) * Math.PI * 2);
      const day = smooth(-0.14, 0.22, height);
      // The light always comes from the top left of the starting view. Only its height changes.
      const lift = ((20 + 50 * Math.max(0, day > 0.5 ? height : -height)) * Math.PI) / 180;
      dir.set(-0.94 * Math.cos(lift), Math.sin(lift), -0.34 * Math.cos(lift)).normalize();

      sun.color.copy(MOON).lerp(SUN_LOW, day).lerp(SUN_HIGH, smooth(0.15, 0.7, height));
      sun.intensity = 0.32 + 2.5 * day;
      hemi.color.copy(NIGHT).lerp(DAY, day).lerp(WHITE, 0.35 * day);
      hemi.groundColor.setRGB(0.1 + 0.32 * day, 0.1 + 0.26 * day, 0.14 + 0.16 * day);
      hemi.intensity = 0.34 + 0.83 * day;
      const dusk = smooth(0.5, 0.0, Math.abs(height)) * smooth(-0.3, 0.05, height);
      sky.copy(NIGHT).lerp(DAY, day).lerp(DUSK, dusk * 0.55);
      fog.color.copy(sky);
      fog.near = distance + 34 - 26 * fogAmount;
      fog.far = distance + 170 - 110 * fogAmount;

      // Fit the shadow to what the camera sees, and move it in whole texels so its edge does not crawl.
      const half = distance * 0.46;
      const texel = (half * 2) / sun.shadow.mapSize.x;
      right.set(0, 1, 0).cross(dir).normalize();
      up.copy(dir).cross(right);
      center.set(focus.x, focus.y, focus.z);
      const u = Math.round(center.dot(right) / texel) * texel, v = Math.round(center.dot(up) / texel) * texel, w = center.dot(dir);
      center.set(0, 0, 0).addScaledVector(right, u).addScaledVector(up, v).addScaledVector(dir, w);
      sun.target.position.copy(center);
      sun.position.copy(center).addScaledVector(dir, 140);
      const cam = sun.shadow.camera;
      if (cam.right !== half) {
        cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
        cam.near = 20; cam.far = 280;
        cam.updateProjectionMatrix();
      }
    },

    setQuality(quality) {
      const size = quality === 'high' ? 2048 : 1024;
      sun.castShadow = quality !== 'low';
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    },
  };
}
