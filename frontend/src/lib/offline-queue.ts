/**
 * Offline sale queue backed by IndexedDB.
 *
 * When the network is unavailable, the POS writes pending sales here and shows
 * a banner. On reconnect, `drainQueue()` replays them against the tRPC API.
 *
 * Data shape mirrors the `sales.complete` mutation input exactly so replaying
 * is a direct pass-through.
 */
import { openDB, type IDBPDatabase } from "idb";

export interface PendingSale {
  id: string;           // local cuid generated offline
  payload: unknown;     // sales.complete input
  queuedAt: string;     // ISO timestamp
  attempts: number;
}

const DB_NAME  = "uptilll-offline";
const DB_VER   = 1;
const STORE    = "pending_sales";

let _db: IDBPDatabase | null = null;

async function db(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VER, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "id" });
      }
    },
  });
  return _db;
}

export async function enqueue(id: string, payload: unknown): Promise<void> {
  const store = await db();
  const item: PendingSale = { id, payload, queuedAt: new Date().toISOString(), attempts: 0 };
  await store.put(STORE, item);
}

export async function dequeue(id: string): Promise<void> {
  const store = await db();
  await store.delete(STORE, id);
}

export async function getAll(): Promise<PendingSale[]> {
  const store = await db();
  return store.getAll(STORE);
}

export async function count(): Promise<number> {
  const store = await db();
  return store.count(STORE);
}

export async function incrementAttempts(id: string): Promise<void> {
  const store = await db();
  const item: PendingSale | undefined = await store.get(STORE, id);
  if (item) {
    item.attempts += 1;
    await store.put(STORE, item);
  }
}
