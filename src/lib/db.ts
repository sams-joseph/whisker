import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import type { SQLiteDatabase } from "expo-sqlite";
import type { Category, ParsedReceipt, ReceiptItem } from "./types";

export const DATABASE_NAME = "whisker.db";
const SCHEMA_VERSION = 1;

/** The open expo-sqlite connection (or transaction) queries run against. */
export class Database extends Context.Service<Database, SQLiteDatabase>()("whisker/Database") {}

export class DbError extends Data.TaggedError("DbError")<{ cause: unknown }> {}

export type PantryItem = {
  id: number;
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  low_threshold: number;
  updated_at: string;
};

export function isLow(item: Pick<PantryItem, "quantity" | "low_threshold">) {
  return item.quantity <= item.low_threshold;
}

const use = <A>(f: (db: SQLiteDatabase) => Promise<A>) =>
  Effect.gen(function* () {
    const db = yield* Database;
    return yield* Effect.tryPromise({ try: () => f(db), catch: (cause) => new DbError({ cause }) });
  });

export const migrate = use(async (db) => {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_key TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL DEFAULT 'other',
        quantity REAL NOT NULL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT 'ea',
        low_threshold REAL NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store TEXT,
        purchased_on TEXT,
        total REAL,
        item_count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
});

const nameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

const COUNT_UNITS = new Set(["ea", "each", "ct", "count", "pack", "pk", "dozen", "can", "box", "bag", "bottle", "jar"]);

/** Default "running low" point: a quarter of what was bought, at least 1 for countable things. */
export function defaultThreshold(quantity: number, unit: string) {
  const quarter = quantity * 0.25;
  return COUNT_UNITS.has(unit.toLowerCase()) ? Math.max(1, Math.floor(quarter)) : Math.round(quarter * 100) / 100;
}

const ITEM_COLUMNS = "id, name, category, quantity, unit, low_threshold, updated_at";

export const listItems = use((db) =>
  db.getAllAsync<PantryItem>(`SELECT ${ITEM_COLUMNS} FROM items ORDER BY category, name COLLATE NOCASE`),
);

export const getItem = (id: number) =>
  use((db) => db.getFirstAsync<PantryItem>(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = ?`, id));

export type NewItem = {
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  low_threshold?: number;
};

export const upsertItem = (item: NewItem) =>
  use(async (db) => {
    const key = nameKey(item.name);
    const existing = await db.getFirstAsync<PantryItem>(`SELECT ${ITEM_COLUMNS} FROM items WHERE name_key = ?`, key);
    if (!existing) {
      await db.runAsync(
        "INSERT INTO items (name, name_key, category, quantity, unit, low_threshold) VALUES (?, ?, ?, ?, ?, ?)",
        item.name.trim(),
        key,
        item.category,
        item.quantity,
        item.unit,
        item.low_threshold ?? defaultThreshold(item.quantity, item.unit),
      );
      return;
    }
    // Same unit: add to stock. Different unit: the new purchase replaces the old count.
    const sameUnit = nameKey(existing.unit) === nameKey(item.unit);
    await db.runAsync(
      "UPDATE items SET quantity = ?, unit = ?, updated_at = datetime('now') WHERE id = ?",
      sameUnit ? existing.quantity + item.quantity : item.quantity,
      sameUnit ? existing.unit : item.unit,
      existing.id,
    );
  });

export type ItemFields = Partial<Pick<PantryItem, "name" | "category" | "quantity" | "unit" | "low_threshold">>;

export const updateItem = (id: number, fields: ItemFields) =>
  use(async (db) => {
    const sets: string[] = [];
    const values: (string | number)[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      sets.push(`${key} = ?`);
      values.push(value);
      if (key === "name") {
        sets.push("name_key = ?");
        values.push(nameKey(String(value)));
      }
    }
    if (sets.length === 0) return;
    await db.runAsync(`UPDATE items SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`, ...values, id);
  });

export const deleteItem = (id: number) => use((db) => db.runAsync("DELETE FROM items WHERE id = ?", id));

/** Runs `effect` inside an exclusive transaction; its queries use the transaction connection. */
export const transaction = <A, E>(effect: Effect.Effect<A, E, Database>) =>
  Effect.gen(function* () {
    const db = yield* Database;
    let result: A | undefined;
    yield* Effect.tryPromise({
      try: () =>
        db.withExclusiveTransactionAsync(async (txn) => {
          result = await Effect.runPromise(effect.pipe(Effect.provideService(Database, txn)));
        }),
      catch: (cause) => new DbError({ cause }),
    });
    return result as A;
  });

export const addReceipt = (receipt: ParsedReceipt, items: ReadonlyArray<ReceiptItem>) =>
  transaction(
    Effect.gen(function* () {
      yield* Effect.forEach(items, upsertItem, { discard: true });
      yield* use((db) =>
        db.runAsync(
          "INSERT INTO receipts (store, purchased_on, total, item_count) VALUES (?, ?, ?, ?)",
          receipt.store,
          receipt.purchased_on,
          receipt.total,
          items.length,
        ),
      );
    }),
  );
