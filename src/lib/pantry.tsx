import * as Effect from "effect/Effect";
import { addDatabaseChangeListener, useSQLiteContext } from "expo-sqlite";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { notifyRunningLow } from "./alerts";
import * as db from "./db";
import type { ParsedReceipt, ReceiptItem } from "./types";

type Pantry = {
  items: db.PantryItem[];
  lowItems: db.PantryItem[];
  loading: boolean;
  setQuantity: (item: db.PantryItem, quantity: number) => Promise<void>;
  saveItem: (id: number | null, fields: Omit<db.PantryItem, "id" | "updated_at">) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;
  addReceipt: (receipt: ParsedReceipt, items: ReadonlyArray<ReceiptItem>) => Promise<void>;
};

const PantryContext = createContext<Pantry | null>(null);

const alertIfNewlyLow = (
  before: db.PantryItem | null,
  after: Pick<db.PantryItem, "name" | "quantity" | "low_threshold">,
) =>
  db.isLow(after) && (!before || !db.isLow(before))
    ? Effect.promise(() => notifyRunningLow([after.name])).pipe(Effect.ignore)
    : Effect.void;

export function PantryProvider({ children }: { children: ReactNode }) {
  const database = useSQLiteContext();
  const [items, setItems] = useState<db.PantryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const run = useCallback(
    <A, E>(effect: Effect.Effect<A, E, db.Database>) =>
      Effect.runPromise(effect.pipe(Effect.provideService(db.Database, database))),
    [database],
  );

  useEffect(() => {
    let active = true;
    const reload = () =>
      run(db.listItems).then((rows) => {
        if (!active) return;
        setItems(rows);
        setLoading(false);
      });
    reload();
    const subscription = addDatabaseChangeListener(() => reload());
    return () => {
      active = false;
      subscription.remove();
    };
  }, [run]);

  const value = useMemo<Pantry>(
    () => ({
      items,
      lowItems: items.filter(db.isLow),
      loading,
      setQuantity: (item, quantity) => {
        const next = Math.max(0, Math.round(quantity * 100) / 100);
        return run(
          db.updateItem(item.id, { quantity: next }).pipe(
            Effect.andThen(alertIfNewlyLow(item, { ...item, quantity: next })),
          ),
        );
      },
      saveItem: (id, fields) =>
        run(
          id === null
            ? db.upsertItem(fields)
            : Effect.gen(function* () {
                const before = yield* db.getItem(id);
                yield* db.updateItem(id, fields);
                yield* alertIfNewlyLow(before, fields);
              }),
        ),
      deleteItem: (id) => run(db.deleteItem(id).pipe(Effect.asVoid)),
      addReceipt: (receipt, receiptItems) => run(db.addReceipt(receipt, receiptItems)),
    }),
    [items, loading, run],
  );

  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>;
}

export function usePantry() {
  const pantry = useContext(PantryContext);
  if (!pantry) throw new Error("usePantry must be used inside PantryProvider");
  return pantry;
}
