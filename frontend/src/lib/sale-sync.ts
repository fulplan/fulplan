/**
 * Network-aware sale submission.
 *
 * Online  → call tRPC directly and return.
 * Offline → enqueue to IndexedDB, throw OfflineError so the UI shows
 *           "saved for sync" instead of an error toast.
 */
import { enqueue, getAll, dequeue, incrementAttempts } from "./offline-queue";

export class OfflineError extends Error {
  readonly localId: string;
  constructor(localId: string) {
    super("Saved offline — will sync when connection is restored");
    this.name = "OfflineError";
    this.localId = localId;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyInput = any;
type MutateFn = (input: AnyInput) => Promise<unknown>;

export async function submitSale(input: AnyInput, mutate: MutateFn): Promise<void> {
  if (navigator.onLine) {
    await mutate(input);
    return;
  }

  const localId = crypto.randomUUID();
  await enqueue(localId, input);
  throw new OfflineError(localId);
}

export async function drainQueue(
  mutate: MutateFn
): Promise<{ synced: number; failed: number }> {
  const items = await getAll();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await mutate(item.payload);
      await dequeue(item.id);
      synced++;
    } catch (err) {
      await incrementAttempts(item.id);
      failed++;
      console.error("[offline-sync] failed to replay sale", item.id, err);
    }
  }

  return { synced, failed };
}
