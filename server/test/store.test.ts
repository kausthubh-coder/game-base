// The save store against Bun's SQLite, which stands in for the Durable Object's.
import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { runDev } from '../dev.ts';
import { createRoom, type RoomSave } from '../room.ts';
import { sqlStore, type SqlLike } from '../store.ts';

function memory(): { sql: SqlLike; transaction: (run: () => void) => void; writes: string[]; failNext(): void } {
  const db = new Database(':memory:');
  const writes: string[] = [];
  let fail = false;
  return {
    writes,
    failNext() { fail = true; },
    sql: {
      exec(query, ...bindings) {
        if (query.startsWith('INSERT') || query.startsWith('DELETE')) {
          if (fail) throw new Error('the disk is full');
          writes.push(String(bindings[0]));
        }
        const rows = db.query(query).all(...bindings) as Record<string, unknown>[];
        return { toArray: () => rows };
      },
    },
    transaction(run) {
      try {
        db.transaction(run)();
      } finally {
        fail = false;
      }
    },
  };
}

function played(): { save: RoomSave; again(): RoomSave } {
  const room = createRoom();
  room.join('ann', 'Ann');
  room.step();
  runDev(room, { do: 'fill', creatures: 5, placed: 40 });
  for (let i = 0; i < 5; i++) room.step();
  return {
    save: room.save(),
    again() {
      for (let i = 0; i < 5; i++) room.step();
      return room.save();
    },
  };
}

describe('the save store', () => {
  test('a world that was never saved reads as null, and reading it stores nothing', () => {
    const { sql, transaction } = memory();
    expect(sqlStore(sql, transaction).read()).toBeNull();
    expect(sql.exec('SELECT name FROM sqlite_master').toArray()).toEqual([]);
  });

  test('what is written is read back whole, by a store that starts cold', () => {
    const { sql, transaction } = memory();
    const { save } = played();
    sqlStore(sql, transaction).write(save);
    const back = sqlStore(sql, transaction).read() as RoomSave;
    const sorted = (s: RoomSave): RoomSave => ({ ...s, world: { ...s.world, edits: [...s.world.edits].sort((a, b) => a[0] - b[0] || a[1] - b[1]) } });
    expect(sorted(back)).toEqual(sorted(JSON.parse(JSON.stringify(save))));
    expect(back.world.edits.length).toBeGreaterThan(0);
  });

  test('a second save writes only the rows that changed', () => {
    const { sql, transaction, writes } = memory();
    const { save, again } = played();
    const store = sqlStore(sql, transaction);
    const first = store.write(save);
    expect(first.rows).toBe(3 + save.world.edits.length);
    writes.length = 0;
    // Five more steps move the clock. The player stood still and no block changed.
    const second = store.write(again());
    expect(writes.sort()).toEqual(['game', 'meta']);
    expect(second.rows).toBe(2);
  });

  test('a write that fails leaves the old save, and the next write puts everything right', () => {
    const { sql, transaction, failNext } = memory();
    const { save, again } = played();
    const store = sqlStore(sql, transaction);
    store.write(save);
    const later = again();
    failNext();
    expect(() => store.write(later)).toThrow('the disk is full');
    expect((sqlStore(sql, transaction).read() as RoomSave).steps).toBe(save.steps);
    store.write(later);
    expect((sqlStore(sql, transaction).read() as RoomSave).steps).toBe(later.steps);
  });
});
