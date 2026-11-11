// The world's save in the Durable Object's own SQLite storage.
//
// One table, `save`, of keys and JSON text. Each changed chunk is its own row, `chunk:<cx>:<cz>`, and the
// rest are `meta`, `game` and `places`. A save writes only the rows whose text changed, in one
// transaction, and no row comes near the 8 MB a row may hold as the world grows.
import type { GameSave } from '../src/game/kernel.sim.ts';
import type { RoomSave } from './room.ts';

/** The part of a Durable Object's storage this file uses. A test hands in another SQLite with the same shape. */
export interface SqlLike {
  exec(query: string, ...bindings: (string | number | null)[]): { toArray(): Record<string, unknown>[] };
}

export interface SaveStore {
  /** The save, or null in a world that was never saved. */
  read(): RoomSave | null;
  /** Writes what changed since the last write or read. */
  write(save: RoomSave): { rows: number; bytes: number };
}

/** A short mark of a text: its length and a hash. Kept in place of the text, so the save is not held twice. */
function markOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return `${text.length}:${hash >>> 0}`;
}

/** `transaction` runs its callback with every write in it kept or dropped together: `ctx.storage.transactionSync`. */
export function sqlStore(sql: SqlLike, transaction: (run: () => void) => void): SaveStore {
  sql.exec('CREATE TABLE IF NOT EXISTS save (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  /** The mark of every row as it is stored. */
  const stored = new Map<string, string>();

  return {
    read() {
      stored.clear();
      const rows = new Map<string, string>();
      for (const row of sql.exec('SELECT key, value FROM save').toArray()) {
        const key = String(row.key), value = String(row.value);
        rows.set(key, value);
        stored.set(key, markOf(value));
      }
      const meta = rows.get('meta'), game = rows.get('game');
      if (!meta || !game) return null;
      const { version, steps, seed } = JSON.parse(meta) as { version: 1; steps: number; seed: number };
      const edits: RoomSave['world']['edits'] = [];
      for (const [key, value] of rows) {
        if (!key.startsWith('chunk:')) continue;
        const [, cx, cz] = key.split(':');
        edits.push([Number(cx), Number(cz), JSON.parse(value) as number[]]);
      }
      return {
        version, steps,
        world: { version: 1, seed, edits },
        game: JSON.parse(game) as GameSave,
        places: JSON.parse(rows.get('places') ?? '{}') as RoomSave['places'],
      };
    },

    write(save) {
      const rows = new Map<string, string>();
      rows.set('meta', JSON.stringify({ version: save.version, steps: save.steps, seed: save.world.seed }));
      rows.set('game', JSON.stringify(save.game));
      rows.set('places', JSON.stringify(save.places));
      for (const [cx, cz, cells] of save.world.edits) rows.set(`chunk:${cx}:${cz}`, JSON.stringify(cells));

      // What differs from what is stored. The marks are taken over only once the transaction has held.
      const changed: [key: string, value: string, mark: string][] = [];
      for (const [key, value] of rows) {
        const mark = markOf(value);
        if (stored.get(key) !== mark) changed.push([key, value, mark]);
      }
      const dropped = [...stored.keys()].filter((key) => !rows.has(key));
      transaction(() => {
        for (const [key, value] of changed) sql.exec('INSERT INTO save (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
        for (const key of dropped) sql.exec('DELETE FROM save WHERE key = ?', key);
      });
      let bytes = 0;
      for (const [key, value, mark] of changed) {
        stored.set(key, mark);
        bytes += value.length;
      }
      for (const key of dropped) stored.delete(key);
      const written = changed.length + dropped.length;
      return { rows: written, bytes };
    },
  };
}
