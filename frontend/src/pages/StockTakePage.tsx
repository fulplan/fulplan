import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { trpc } from "../lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@uptilll/backend/src/routers";

type RouterOutput = inferRouterOutputs<AppRouter>;
type CurrentTake = NonNullable<RouterOutput["stockTakes"]["current"]>;
type TakeItem = CurrentTake["items"][number];

// ── Main page ──────────────────────────────────────────────────────────────

export function StockTakePage() {
  const { user } = useAuth();
  const branchId = user?.branchId ?? "";

  const utils = trpc.useUtils();
  const { data: current, isLoading } = trpc.stockTakes.current.useQuery(
    { branchId },
    { enabled: !!branchId },
  );
  const { data: pastList } = trpc.stockTakes.list.useQuery(
    { branchId },
    { enabled: !!branchId },
  );

  const startMutation = trpc.stockTakes.start.useMutation({
    onSuccess: () => utils.stockTakes.current.invalidate(),
  });

  const [startError, setStartError] = useState<string | null>(null);
  const [closeResult, setCloseResult] = useState<{
    adjustmentsApplied: number;
    itemsCounted: number;
    itemsTotal: number;
  } | null>(null);

  if (!branchId) {
    return (
      <div className="p-6 text-sm text-muted">
        No branch assigned — ask the owner to assign you to a branch.
      </div>
    );
  }

  if (isLoading) return <div className="p-4 text-sm text-muted">Loading…</div>;

  return (
    <div className="flex flex-col min-h-full">
      <div className="border-b border-line px-6 py-4 bg-paper">
        <h1 className="text-sm font-semibold text-ink">Stock take</h1>
        <p className="text-xs text-muted mt-0.5">Count and reconcile inventory</p>
      </div>
      <div className="px-6 py-4 max-w-2xl">

      {/* ── Close result banner ── */}
      {closeResult && (
        <div className="mb-4 border border-brand bg-paper px-4 py-3">
          <p className="font-semibold text-sm">Stock take complete</p>
          <p className="text-xs text-muted mt-1">
            {closeResult.itemsCounted} of {closeResult.itemsTotal} products counted ·{" "}
            {closeResult.adjustmentsApplied} adjustment{closeResult.adjustmentsApplied !== 1 ? "s" : ""} applied
          </p>
          <button
            className="mt-2 text-xs underline text-muted"
            onClick={() => setCloseResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Active session ── */}
      {current ? (
        <ActiveTake
          take={current}
          onClose={(result) => {
            setCloseResult(result);
            utils.stockTakes.current.invalidate();
            utils.stockTakes.list.invalidate();
          }}
        />
      ) : (
        <NoActiveTake
          isStarting={startMutation.isPending}
          error={startError ?? startMutation.error?.message ?? null}
          onStart={() => {
            setStartError(null);
            setCloseResult(null);
            startMutation.mutate({ branchId });
          }}
        />
      )}

      {/* ── Past sessions ── */}
      {pastList && pastList.length > 0 && (
        <div className="mt-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-2">Past sessions</p>
          <div className="border border-line divide-y divide-line">
            {pastList.map((s) => (
              <div key={s.id} className="px-4 py-3 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-xs text-muted">
                    {s._count.items} products · closed by {s.closedBy?.name ?? "—"}
                  </span>
                </div>
                {s.note && <div className="text-xs text-muted mt-0.5">{s.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ── No active session ──────────────────────────────────────────────────────

function NoActiveTake({
  isStarting,
  error,
  onStart,
}: {
  isStarting: boolean;
  error: string | null;
  onStart: () => void;
}) {
  return (
    <div className="border border-line p-6 text-center">
      <p className="text-sm text-muted mb-4">No stock take in progress.</p>
      {error && <p className="text-danger text-xs mb-3">{error}</p>}
      <button
        onClick={onStart}
        disabled={isStarting}
        className="px-6 py-2.5 bg-ink text-paper font-semibold text-sm hover:opacity-80 disabled:opacity-50"
      >
        {isStarting ? "Starting…" : "Start stock take"}
      </button>
    </div>
  );
}

// ── Active session ─────────────────────────────────────────────────────────

function ActiveTake({
  take,
  onClose,
}: {
  take: CurrentTake;
  onClose: (result: { adjustmentsApplied: number; itemsCounted: number; itemsTotal: number }) => void;
}) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [filter, setFilter] = useState<"all" | "counted" | "uncounted">("all");

  const utils = trpc.useUtils();

  const setCountMutation = trpc.stockTakes.setCount.useMutation({
    onSuccess: () => utils.stockTakes.current.invalidate(),
  });

  const closeMutation = trpc.stockTakes.close.useMutation({
    onSuccess: (result) => onClose(result),
  });

  // Merge server state with local draft (local overrides until blur)
  const items: TakeItem[] = take.items;
  const countedCount = items.filter((i) => i.countedQty != null).length;
  const discrepancies = items.filter(
    (i) => i.countedQty != null && i.countedQty !== i.expectedQty,
  ).length;

  const filtered = items.filter((item) => {
    if (filter === "counted") return item.countedQty != null;
    if (filter === "uncounted") return item.countedQty == null;
    return true;
  });

  function handleBlur(item: TakeItem, rawValue: string) {
    const parsed = parseInt(rawValue, 10);
    if (isNaN(parsed) || parsed < 0) return;
    if (parsed === (item.countedQty ?? undefined)) return; // no change
    setCountMutation.mutate({
      stockTakeId: take.id,
      productId: item.productId,
      countedQty: parsed,
    });
  }

  return (
    <div>
      {/* Header stats */}
      <div className="border border-line p-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold">Session in progress</span>
          <span className="text-xs text-muted">Started by {take.createdBy.name}</span>
        </div>
        <div className="flex gap-4 text-xs text-muted mt-2">
          <span className="font-semibold text-ink">{countedCount}/{items.length}</span> counted
          {discrepancies > 0 && (
            <span className="text-danger font-semibold">{discrepancies} discrepanc{discrepancies !== 1 ? "ies" : "y"}</span>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full bg-line">
          <div
            className="h-1.5 bg-brand transition-all"
            style={{ width: `${items.length > 0 ? (countedCount / items.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0 mb-3 border border-line">
        {(["all", "uncounted", "counted"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "flex-1 py-2 text-xs font-medium capitalize",
              filter === f ? "bg-ink text-paper" : "hover:bg-field",
            ].join(" ")}
          >
            {f === "all" ? `All (${items.length})` : f === "uncounted" ? `To count (${items.filter((i) => i.countedQty == null).length})` : `Counted (${countedCount})`}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div className="border border-line divide-y divide-line mb-4">
        {filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted">No items.</div>
        )}
        {filtered.map((item) => {
          const localVal = counts[item.productId] ?? (item.countedQty != null ? String(item.countedQty) : "");
          const serverQty = item.countedQty;
          const hasDiscrepancy = serverQty != null && serverQty !== item.expectedQty;

          return (
            <div key={item.productId} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.name}</div>
                <div className="text-xs text-muted">
                  Expected: <span className="tabular-nums font-mono">{item.expectedQty}</span>
                  {hasDiscrepancy && (
                    <span className={`ml-2 font-semibold ${serverQty! > item.expectedQty ? "text-brand" : "text-danger"}`}>
                      {serverQty! > item.expectedQty ? "+" : ""}{serverQty! - item.expectedQty}
                    </span>
                  )}
                </div>
              </div>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Count"
                value={localVal}
                onChange={(e) =>
                  setCounts((prev) => ({ ...prev, [item.productId]: e.target.value }))
                }
                onBlur={(e) => {
                  handleBlur(item, e.target.value);
                }}
                className={[
                  "w-20 border px-2 py-1.5 text-sm text-right font-mono tabular-nums focus:outline-none focus:border-ink",
                  hasDiscrepancy ? "border-danger bg-paper" : serverQty != null ? "border-brand" : "border-line",
                ].join(" ")}
              />
            </div>
          );
        })}
      </div>

      {/* Close button */}
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={countedCount === 0}
          className="w-full py-2.5 border border-line text-sm font-semibold text-ink hover:bg-field disabled:opacity-30"
        >
          Finish &amp; apply adjustments
        </button>
      ) : (
        <ConfirmClose
          discrepancies={discrepancies}
          uncounted={items.length - countedCount}
          isClosing={closeMutation.isPending}
          error={closeMutation.error?.message ?? null}
          onConfirm={() => closeMutation.mutate({ stockTakeId: take.id })}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

// ── Confirm close panel ────────────────────────────────────────────────────

function ConfirmClose({
  discrepancies,
  uncounted,
  isClosing,
  error,
  onConfirm,
  onCancel,
}: {
  discrepancies: number;
  uncounted: number;
  isClosing: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border border-line p-4 bg-field">
      <p className="font-semibold text-sm mb-2">Finish stock take?</p>
      <ul className="text-xs text-muted space-y-1 mb-4">
        <li>{discrepancies} adjustment{discrepancies !== 1 ? "s" : ""} will be applied to stock levels.</li>
        {uncounted > 0 && (
          <li className="text-amber-600">{uncounted} uncounted product{uncounted !== 1 ? "s" : ""} will be skipped (assumed correct).</li>
        )}
      </ul>
      {error && <p className="text-danger text-xs mb-3">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={isClosing}
          className="flex-1 py-2 bg-ink text-paper text-sm font-semibold disabled:opacity-50"
        >
          {isClosing ? "Applying…" : "Confirm & close"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-line text-sm"
        >
          Back
        </button>
      </div>
    </div>
  );
}
