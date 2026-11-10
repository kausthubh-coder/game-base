// What is marked on the map: pins the game adds, rumors, the player's own waypoints, and what the
// crew shares. Rules only. The drawing reads these lists and `version`.

/** How many waypoints one player keeps. */
export const WAYPOINT_LIMIT = 20;
/** Seconds a quick ping stays. */
export const PING_SECONDS = 10;

export const WAYPOINT_ICONS = ['flag', 'star', 'home', 'gem', 'leaf', 'fish', 'danger', 'heart'] as const;
export type WaypointIcon = (typeof WAYPOINT_ICONS)[number];

/** Waypoint colors by name, as 0xRRGGBB. A save keeps the name, so the colors can be retuned. */
export const WAYPOINT_COLORS = {
  flame: 0xe0602a,
  ochre: 0xd9a22f,
  bloom: 0x4f9e3a,
  tide: 0x2f80d0,
  spark: 0x8f5fd8,
  rose: 0xd4568a,
} as const;
export type WaypointColor = keyof typeof WAYPOINT_COLORS;
export const WAYPOINT_COLOR_NAMES = Object.keys(WAYPOINT_COLORS) as WaypointColor[];

export interface Waypoint {
  id: number;
  x: number;
  z: number;
  icon: WaypointIcon;
  color: WaypointColor;
  /** Marked for the crew: every player sees it. */
  shared: boolean;
  label: string;
}

/** A waypoint another player shared. */
export interface CrewWaypoint extends Waypoint {
  owner: string;
}

export const PIN_KINDS = ['waystone', 'gate', 'shop', 'vault', 'quest', 'farm'] as const;
export type PinKind = (typeof PIN_KINDS)[number];

/** A place the game marks by itself: a waystone the player woke, a shop, a quest target. */
export interface Pin {
  id: string;
  kind: PinKind;
  x: number;
  z: number;
  label: string;
}

/** A rumor: somewhere inside this circle. The exact spot is never kept. */
export interface Rumor {
  id: string;
  x: number;
  z: number;
  radius: number;
  label: string;
}

/** A quick ping from a player. It needs no menu and fades by itself. */
export interface Ping {
  x: number;
  z: number;
  owner: string;
  color: WaypointColor;
  /** Seconds left. */
  left: number;
}

export interface MarksSave {
  waypoints: Waypoint[];
  active: number | null;
  pins: Pin[];
  rumors: Rumor[];
}

export type WaypointOptions = Partial<Pick<Waypoint, 'icon' | 'color' | 'shared' | 'label'>>;

/** A small hash of a name to a number from 0 to 1, the same on every machine. */
function hash01(text: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const isIcon = (v: unknown): v is WaypointIcon => WAYPOINT_ICONS.includes(v as WaypointIcon);
const isColor = (v: unknown): v is WaypointColor => typeof v === 'string' && v in WAYPOINT_COLORS;
const isKind = (v: unknown): v is PinKind => PIN_KINDS.includes(v as PinKind);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export class Marks {
  readonly pins: Pin[] = [];
  readonly rumors: Rumor[] = [];
  /** The player's own waypoints, oldest first. Never more than `WAYPOINT_LIMIT`. */
  readonly waypoints: Waypoint[] = [];
  /** Waypoints other players shared. */
  readonly crew: CrewWaypoint[] = [];
  readonly pings: Ping[] = [];
  /** Goes up on every change. A drawing compares it to know when to redraw. */
  version = 0;

  private activeId: number | null = null;
  private nextId = 1;

  /** The waypoint the player is following, or null. */
  get active(): Waypoint | null {
    if (this.activeId === null) return null;
    for (let i = 0; i < this.waypoints.length; i++) if (this.waypoints[i].id === this.activeId) return this.waypoints[i];
    return null;
  }

  /** True when the player has room for one more waypoint. */
  get hasRoom(): boolean {
    return this.waypoints.length < WAYPOINT_LIMIT;
  }

  /** Drops a waypoint. Returns null when the player already has 20. */
  addWaypoint(x: number, z: number, options: WaypointOptions = {}): Waypoint | null {
    if (!this.hasRoom) return null;
    const waypoint: Waypoint = {
      id: this.nextId++, x, z,
      icon: options.icon ?? 'flag', color: options.color ?? 'flame', shared: options.shared ?? false, label: options.label ?? '',
    };
    this.waypoints.push(waypoint);
    this.version++;
    return waypoint;
  }

  /** Changes a waypoint's icon, color, label, place or whether the crew sees it. */
  updateWaypoint(id: number, patch: Partial<Omit<Waypoint, 'id'>>): Waypoint | null {
    const waypoint = this.waypoints.find((w) => w.id === id);
    if (!waypoint) return null;
    Object.assign(waypoint, patch, { id });
    this.version++;
    return waypoint;
  }

  removeWaypoint(id: number): boolean {
    const i = this.waypoints.findIndex((w) => w.id === id);
    if (i < 0) return false;
    this.waypoints.splice(i, 1);
    if (this.activeId === id) this.activeId = null;
    this.version++;
    return true;
  }

  /** Follows one waypoint, or none with null. Only one is active at a time. Returns false for an id that is not there. */
  setActive(id: number | null): boolean {
    if (id !== null && !this.waypoints.some((w) => w.id === id)) return false;
    if (this.activeId !== id) {
      this.activeId = id;
      this.version++;
    }
    return true;
  }

  /** The player's waypoints that are marked for the crew, to send to the other players. */
  sharedWaypoints(): Waypoint[] {
    return this.waypoints.filter((w) => w.shared);
  }

  /** Replaces everything one other player shares. An empty list removes that player's marks. */
  setCrew(owner: string, waypoints: readonly Omit<Waypoint, 'id' | 'shared'>[]): void {
    for (let i = this.crew.length - 1; i >= 0; i--) if (this.crew[i].owner === owner) this.crew.splice(i, 1);
    for (const w of waypoints) this.crew.push({ ...w, id: -(this.crew.length + 1), shared: true, owner });
    this.version++;
  }

  /** Adds a pin, or replaces the pin with the same id. */
  setPin(pin: Pin): void {
    const i = this.pins.findIndex((p) => p.id === pin.id);
    if (i < 0) this.pins.push({ ...pin });
    else this.pins[i] = { ...pin };
    this.version++;
  }

  removePin(id: string): boolean {
    const i = this.pins.findIndex((p) => p.id === id);
    if (i < 0) return false;
    this.pins.splice(i, 1);
    this.version++;
    return true;
  }

  /**
   * Adds a rumor about a spot. The map keeps a circle that holds the spot, with its middle pushed
   * off the spot by a quarter to three quarters of the radius, and forgets the spot itself. The
   * push depends only on the id, so every player's circle is the same.
   */
  setRumor(id: string, spotX: number, spotZ: number, radius: number, label = ''): Rumor {
    const angle = hash01(id, 1) * Math.PI * 2;
    const push = radius * (0.25 + 0.5 * hash01(id, 2));
    const rumor: Rumor = { id, x: Math.round(spotX + Math.cos(angle) * push), z: Math.round(spotZ + Math.sin(angle) * push), radius, label };
    const i = this.rumors.findIndex((r) => r.id === id);
    if (i < 0) this.rumors.push(rumor);
    else this.rumors[i] = rumor;
    this.version++;
    return rumor;
  }

  removeRumor(id: string): boolean {
    const i = this.rumors.findIndex((r) => r.id === id);
    if (i < 0) return false;
    this.rumors.splice(i, 1);
    this.version++;
    return true;
  }

  /** A quick ping at a point. It stays for 10 seconds. */
  ping(x: number, z: number, owner: string, color: WaypointColor = 'ochre'): void {
    this.pings.push({ x, z, owner, color, left: PING_SECONDS });
    this.version++;
  }

  /** Ages the pings. Call it every frame. */
  tick(dt: number): void {
    const pings = this.pings;
    if (pings.length === 0) return;
    for (let i = pings.length - 1; i >= 0; i--) {
      pings[i].left -= dt;
      if (pings[i].left <= 0) {
        pings.splice(i, 1);
        this.version++;
      }
    }
  }

  /** What to keep between visits: the player's waypoints, pins and rumors. Crew marks and pings come from the other players again. */
  save(): MarksSave {
    return {
      waypoints: this.waypoints.map((w) => ({ ...w })),
      active: this.activeId,
      pins: this.pins.map((p) => ({ ...p })),
      rumors: this.rumors.map((r) => ({ ...r })),
    };
  }

  /** Replaces the marks with a save. Anything in it that is not a valid mark is dropped. */
  load(save: unknown): boolean {
    this.waypoints.length = 0;
    this.pins.length = 0;
    this.rumors.length = 0;
    this.activeId = null;
    this.nextId = 1;
    this.version++;
    const data = save as Partial<MarksSave> | null;
    if (!data || typeof data !== 'object') return false;
    for (const w of Array.isArray(data.waypoints) ? data.waypoints : []) {
      if (this.waypoints.length >= WAYPOINT_LIMIT) break;
      if (!w || !isNumber(w.id) || !isNumber(w.x) || !isNumber(w.z) || !isIcon(w.icon) || !isColor(w.color)) continue;
      if (this.waypoints.some((other) => other.id === w.id)) continue;
      this.waypoints.push({ id: w.id, x: w.x, z: w.z, icon: w.icon, color: w.color, shared: w.shared === true, label: typeof w.label === 'string' ? w.label : '' });
      this.nextId = Math.max(this.nextId, w.id + 1);
    }
    if (isNumber(data.active) && this.waypoints.some((w) => w.id === data.active)) this.activeId = data.active;
    for (const p of Array.isArray(data.pins) ? data.pins : []) {
      if (!p || typeof p.id !== 'string' || !isKind(p.kind) || !isNumber(p.x) || !isNumber(p.z)) continue;
      this.pins.push({ id: p.id, kind: p.kind, x: p.x, z: p.z, label: typeof p.label === 'string' ? p.label : '' });
    }
    for (const r of Array.isArray(data.rumors) ? data.rumors : []) {
      if (!r || typeof r.id !== 'string' || !isNumber(r.x) || !isNumber(r.z) || !isNumber(r.radius)) continue;
      this.rumors.push({ id: r.id, x: r.x, z: r.z, radius: r.radius, label: typeof r.label === 'string' ? r.label : '' });
    }
    return true;
  }
}
