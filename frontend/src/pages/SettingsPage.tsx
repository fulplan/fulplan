import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { trpc } from "../lib/trpc";

// ── CSV helper ────────────────────────────────────────────────────────────────

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    alert("No data to export for this period.");
    return;
  }
  const first = rows[0];
  if (!first) return;
  const headers = Object.keys(first);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

function yearRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-8">
      <h1 className="text-xl font-bold">Settings</h1>
      <ExportSection />
      {isOwner && <DangerZone />}
    </div>
  );
}

// ── Export section ────────────────────────────────────────────────────────────

function ExportSection() {
  const [salesPeriod, setSalesPeriod] = useState<"month" | "year">("month");
  const [expPeriod, setExpPeriod] = useState<"month" | "year">("month");

  const utils = trpc.useUtils();

  async function exportSales() {
    const range = salesPeriod === "month" ? monthRange() : yearRange();
    const data = await utils.export.sales.fetch(range);
    const label = salesPeriod === "month" ? "this-month" : "this-year";
    downloadCsv(`ghpos-sales-${label}.csv`, data as Record<string, unknown>[]);
  }

  async function exportProducts() {
    const data = await utils.export.products.fetch();
    downloadCsv("ghpos-products.csv", data as Record<string, unknown>[]);
  }

  async function exportCustomers() {
    const data = await utils.export.customers.fetch();
    downloadCsv("ghpos-customers.csv", data as Record<string, unknown>[]);
  }

  async function exportExpenses() {
    const range = expPeriod === "month" ? monthRange() : yearRange();
    const data = await utils.export.expenses.fetch(range);
    const label = expPeriod === "month" ? "this-month" : "this-year";
    downloadCsv(`ghpos-expenses-${label}.csv`, data as Record<string, unknown>[]);
  }

  return (
    <section>
      <h2 className="font-semibold text-sm mb-3">Export data</h2>
      <div className="border border-line divide-y divide-line">

        {/* Sales */}
        <ExportRow
          label="Sales"
          description="All transactions with line items, payment method, cashier"
          period={salesPeriod}
          onPeriodChange={setSalesPeriod}
          onExport={exportSales}
        />

        {/* Products */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium">Products & stock</div>
            <div className="text-xs text-muted">Current inventory snapshot with cost and selling prices</div>
          </div>
          <ExportButton onClick={exportProducts} label="Export CSV" />
        </div>

        {/* Customers */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium">Customers</div>
            <div className="text-xs text-muted">Customer list with outstanding credit balances</div>
          </div>
          <ExportButton onClick={exportCustomers} label="Export CSV" />
        </div>

        {/* Expenses */}
        <ExportRow
          label="Expenses"
          description="Business expenses log with categories"
          period={expPeriod}
          onPeriodChange={setExpPeriod}
          onExport={exportExpenses}
        />

      </div>
    </section>
  );
}

function ExportRow({
  label,
  description,
  period,
  onPeriodChange,
  onExport,
}: {
  label: string;
  description: string;
  period: "month" | "year";
  onPeriodChange: (p: "month" | "year") => void;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted">{description}</div>
        <div className="flex gap-1 mt-1.5">
          {(["month", "year"] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={[
                "px-2 py-0.5 text-xs border",
                period === p ? "bg-ink text-paper border-ink" : "border-line hover:bg-field",
              ].join(" ")}
            >
              {p === "month" ? "This month" : "This year"}
            </button>
          ))}
        </div>
      </div>
      <ExportButton onClick={onExport} label="Export CSV" />
    </div>
  );
}

function ExportButton({ onClick, label }: { onClick: () => void; label: string }) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="shrink-0 px-3 py-1.5 border border-ink text-sm font-medium hover:bg-field disabled:opacity-50"
    >
      {loading ? "…" : label}
    </button>
  );
}

// ── Danger zone ───────────────────────────────────────────────────────────────

function DangerZone() {
  const utils = trpc.useUtils();
  const { data: status } = trpc.account.deletionStatus.useQuery();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requestMutation = trpc.account.requestDeletion.useMutation({
    onSuccess: () => {
      setShowConfirm(false);
      setConfirmText("");
      utils.account.deletionStatus.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const cancelMutation = trpc.account.cancelDeletion.useMutation({
    onSuccess: () => utils.account.deletionStatus.invalidate(),
    onError: (err) => setError(err.message),
  });

  return (
    <section>
      <h2 className="font-semibold text-sm mb-3 text-danger">Danger zone</h2>
      <div className="border border-danger p-4 space-y-3">

        {status?.scheduled ? (
          <>
            <div className="bg-amber-50 border border-amber-300 px-3 py-2 text-sm">
              <p className="font-semibold text-amber-800">Account deletion scheduled</p>
              <p className="text-xs text-amber-700 mt-1">
                All data will be permanently deleted on{" "}
                <strong>{new Date(status.deleteAt).toLocaleDateString()}</strong>.
                You can cancel before that date.
              </p>
            </div>
            {error && <p className="text-danger text-xs">{error}</p>}
            <button
              onClick={() => { setError(null); cancelMutation.mutate(); }}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 border border-line text-sm hover:bg-field disabled:opacity-50"
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel deletion"}
            </button>
          </>
        ) : (
          <>
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted mt-0.5">
                All data (products, sales, customers, staff) will be permanently deleted after a
                30-day grace period. This cannot be undone once the grace period passes.
              </p>
            </div>

            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="px-4 py-2 border border-danger text-danger text-sm hover:bg-red-50"
              >
                Request account deletion
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium">
                  Type <strong>DELETE</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full border border-line px-3 py-1.5 text-sm focus:outline-none focus:border-danger"
                  placeholder="DELETE"
                  autoFocus
                />
                {error && <p className="text-danger text-xs">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setError(null); requestMutation.mutate(); }}
                    disabled={confirmText !== "DELETE" || requestMutation.isPending}
                    className="px-4 py-2 bg-danger text-paper text-sm font-semibold disabled:opacity-40"
                  >
                    {requestMutation.isPending ? "Scheduling…" : "Confirm deletion"}
                  </button>
                  <button
                    onClick={() => { setShowConfirm(false); setConfirmText(""); setError(null); }}
                    className="px-4 py-2 border border-line text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
