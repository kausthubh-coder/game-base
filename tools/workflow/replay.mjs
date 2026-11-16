/** Installed in the page. Movement uses game keys; state and routes are read-only. */
export function installReplayDriver(config = {}) {
  const g = window.__game;
  const sys = g.view.game.systems;
  const P = g.view.game.player;
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const release = () => { for (const k of ['w', 'a', 's', 'd', 'shift', 'space']) g.key(k, false); };
  /** Holds the keys that point the body at (tx, tz), relative to the camera's yaw. */
  function steer(tx, tz) {
    const yaw = g.view.camera.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const dx = tx - P.pos.x, dz = tz - P.pos.z, len = Math.hypot(dx, dz) || 1;
    const forward = (dx * fx + dz * fz) / len, right = (dx * rx + dz * rz) / len;
    g.key('w', forward > 0.38); g.key('s', forward < -0.38);
    g.key('d', right > 0.38); g.key('a', right < -0.38);
  }

  /**
   * Walks the hero's body to `goal` along nav routes, through `via` first. `soft` holds Shift, or is a function
   * asked every tenth of a second. Returns { ok, seconds, jumps, replans }.
   */
  function walk(goal, options = {}) {
    if (!Number.isFinite(goal.x) || !Number.isFinite(goal.z) || (goal.y !== undefined && !Number.isFinite(goal.y))) throw new Error('walk needs finite world coordinates');
    const within = options.within ?? 0.6;
    const legs = [...(options.via ?? []).map((v) => ({ x: v.x + 0.5, y: v.y, z: v.z + 0.5, via: true })), { ...goal, via: false }];
    let seconds = 0, jumps = 0, replans = 0;
    const limit = options.seconds ?? 300;
    try {
      for (const leg of legs) {
        const near = leg.via ? 3 : within;
        let route = null, at = 0, check = { x: P.pos.x, z: P.pos.z }, sinceCheck = 0;
        while (d2(P.pos, leg) > near || (leg.y !== undefined && Math.abs(P.pos.y - leg.y) > 1)) {
          if (seconds > limit) return { ok: false, seconds, jumps, replans, why: `timed out ${d2(P.pos, leg).toFixed(1)} blocks short` };
          if (!route || at >= route.length) {
            route = sys.nav.toward(P.pos, { x: Math.floor(leg.x) + 0.5, y: leg.y ?? P.pos.y, z: Math.floor(leg.z) + 0.5 }, 4000) ?? [];
            at = 0;
            replans++;
            if (replans > 400) return { ok: false, seconds, jumps, replans, why: `no route, ${d2(P.pos, leg).toFixed(1)} blocks short` };
            if (route.length === 0) route = [{ x: leg.x, y: leg.y, z: leg.z }];
          }
          // Skip route points already reached, and head for the goal itself on the last stretch.
          while (at < route.length - 1 && d2(P.pos, route[at]) < 0.45) at++;
          const target = at >= route.length - 1 && d2(route[route.length - 1], leg) < 1.5 ? leg : route[at];
          // The route ended short of the goal: head straight for it. Asking again here would loop with no time passing.
          if (at === route.length - 1 && d2(P.pos, route[at]) < 0.45 && d2(P.pos, leg) > near) route[at] = { x: leg.x, y: leg.y, z: leg.z };
          const soft = typeof options.soft === 'function' ? options.soft() : Boolean(options.soft);
          g.key('shift', soft);
          steer(target.x, target.z);
          g.advance(0.1);
          seconds += 0.1;
          sinceCheck += 0.1;
          if (sinceCheck >= 1) {
            if (Math.hypot(P.pos.x - check.x, P.pos.z - check.z) < (soft ? 0.25 : 0.5)) {
              // Stuck on a step or a corner: jump, and plan again.
              g.key('space');
              jumps++;
              route = null;
              if (jumps > 40) return { ok: false, seconds, jumps, replans, why: 'stuck' };
            }
            check = { x: P.pos.x, z: P.pos.z };
            sinceCheck = 0;
          }
        }
      }
    } finally {
      release();
      g.advance(0.15);
    }
    return { ok: true, seconds: Math.round(seconds * 10) / 10, jumps, replans };
  }

  function act(target, { reach, aim, press, done }) {
    if (![target.x, target.y, target.z].every(Number.isFinite)) throw new Error('act needs finite world coordinates');
    if (!Number.isFinite(reach) || reach <= 0) throw new Error('act requires the authored interaction reach');
    const distance = Math.hypot(P.pos.x - target.x, P.pos.y - target.y, P.pos.z - target.z);
    if (distance > reach) throw new Error(`target out of reach: ${distance.toFixed(2)} > ${reach}`);
    aim(target);
    press();
    if (!done()) throw new Error('the requested action did not happen');
  }
  // The earned path sends ordinary browser keys through an awaited host binding.
  // It never calls debug key(), advance(), or any game mutation API.
  async function realRelease() {
    for (const key of ['w', 'a', 's', 'd', 'shift', 'space']) await window.__replayInput(key, false);
  }
  async function realWalk(goal, options = {}) {
    if (![goal.x, goal.z].every(Number.isFinite) || (goal.y !== undefined && !Number.isFinite(goal.y))) throw Error('walk needs finite world coordinates');
    const began = Date.now(), limit = (options.seconds ?? 300) * 1000;
    let replans = 0, jumps = 0;
    const legs = [...(options.via ?? []).map(v => ({x:v.x+.5,y:v.y,z:v.z+.5,via:true})), goal];
    try {
      for (const leg of legs) {
        const near = leg.via ? 3 : (options.within ?? .6);
        let route = [], at = 0, checked = Date.now(), prior = {...P.pos}, forwardCarry=0, rightCarry=0;
        while (d2(P.pos, leg) > near || (leg.y !== undefined && Math.abs(P.pos.y-leg.y)>1)) {
          if (Date.now()-began > limit) return {ok:false, why:'timed out before arrival', replans, jumps};
          if (!route.length || at >= route.length) {
            route = options.authored ? [leg] : (sys.nav.toward(P.pos, {x:leg.x,y:leg.y ?? P.pos.y,z:leg.z}, 20000) ?? []);
            if (!route.length) route = [leg];
            at=0; replans++;
          }
          while(at<route.length-1 && d2(P.pos,route[at])<.35) at++;
          let target=route[at];
          if(at===route.length-1 && d2(P.pos,target)<.35) target=leg;
          const yaw=g.view.camera.yaw, dx=target.x-P.pos.x, dz=target.z-P.pos.z;
          const len=Math.hypot(dx,dz)||1;
          const forward=(-dx*Math.sin(yaw)-dz*Math.cos(yaw))/len;
          const right=(dx*Math.cos(yaw)-dz*Math.sin(yaw))/len;
          forwardCarry+=forward;rightCarry+=right;
          const f=Math.round(forwardCarry),r=Math.round(rightCarry);forwardCarry-=f;rightCarry-=r;
          for(const [key,down] of [['w',f>0],['s',f<0],['d',r>0],['a',r<0],['shift',typeof options.soft==='function'?options.soft():!!options.soft]]) await window.__replayInput(key,down);
          await new Promise(resolve=>setTimeout(resolve,options.tickMs ?? 50));
          if(Date.now()-checked>1300) {
            if(d2(P.pos,prior)<.2) { route=[]; await window.__replayInput('space',true); await window.__replayInput('space',false); jumps++; }
            prior={...P.pos};checked=Date.now();
            if(jumps>40) return {ok:false,why:'stuck',replans,jumps};
          }
        }
      }
      return {ok:true,seconds:(Date.now()-began)/1000,replans,jumps};
    } finally { await realRelease(); }
  }
  async function realAct(target, {reach, aim, press, done}) {
    if (![target.x,target.y,target.z].every(Number.isFinite)) throw Error('act needs finite world coordinates');
    if (!Number.isFinite(reach)||reach<=0) throw Error('act requires the authored interaction reach');
    const distance=Math.hypot(P.pos.x-target.x,P.pos.y-target.y,P.pos.z-target.z);
    if(distance>reach) throw Error(`target out of reach: ${distance.toFixed(2)} > ${reach}`);
    await aim(target);
    await press();
    if(await done() !== true) throw Error('the requested action did not happen');
  }
  if(config.mode === 'realtime') {
    if(typeof window.__replayInput !== 'function') throw Error('realtime replay requires a browser keyboard binding');
    window.__replay={walk:realWalk,act:realAct,release:realRelease};
    return window.__replay;
  }
  window.__replay = { walk, act, release };
  return window.__replay;
}
