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
    <div className="flex flex-col min-h-full">
      <div className="border-b border-line px-6 py-4 bg-paper">
        <h1 className="text-sm font-semibold text-ink">Settings</h1>
        <p className="text-xs text-muted mt-0.5">Organisation, branches, and data export</p>
      </div>
      <div className="px-6 py-4 max-w-2xl space-y-8">
        {isOwner && <OrgProfileSection />}
        <BranchSettingsSection isOwner={isOwner} />
        <ExportSection />
        {isOwner && <DangerZone />}
      </div>
    </div>
  );
}

// ── Organisation profile ──────────────────────────────────────────────────────

function OrgProfileSection() {
  const utils = trpc.useUtils();
  const { data } = trpc.account.getOrg.useQuery();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const update = trpc.account.updateOrgName.useMutation({
    onSuccess: () => {
      setEditing(false);
      utils.account.getOrg.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  function startEdit() {
    setName(data?.name ?? "");
    setEditing(true);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    update.mutate({ name: name.trim() });
  }

  return (
    <section>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-3">Organisation</p>
      <div className="border border-line">
        {editing ? (
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <div>
              <label className="block text-xs text-muted mb-1">Business name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-line bg-field px-3 py-2 text-sm focus:outline-none focus:border-ink"
                maxLength={100}
                autoFocus
              />
            </div>
            {error && <p className="text-danger text-xs">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={update.isPending} className="px-4 py-2 bg-ink text-paper text-sm font-semibold hover:opacity-80 disabled:opacity-50">
                {update.isPending ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 border border-line text-sm text-muted hover:bg-field hover:text-ink">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted">Business name</p>
              <p className="text-sm font-semibold mt-0.5">{data?.name ?? "—"}</p>
            </div>
            <button onClick={startEdit} className="px-3 py-1.5 border border-line text-sm hover:bg-field">
              Edit
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Branch settings ───────────────────────────────────────────────────────────

function BranchSettingsSection({ isOwner }: { isOwner: boolean }) {
  const utils = trpc.useUtils();
  const { data: branches, isLoading } = trpc.branches.list.useQuery();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const updateBranch = trpc.branches.update.useMutation({
    onSuccess: () => { setEditingId(null); utils.branches.list.invalidate(); },
  });
  const createBranch = trpc.branches.create.useMutation({
    onSuccess: () => { setAdding(false); utils.branches.list.invalidate(); },
  });

  if (isLoading) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Branches</p>
        {isOwner && (
          <button onClick={() => setAdding(true)} className="px-3 py-1 text-xs border border-line text-muted hover:bg-field hover:text-ink">
            + Add branch
          </button>
        )}
      </div>
      <div className="border border-line divide-y divide-line">
        {branches?.map((b) =>
          editingId === b.id ? (
            <BranchEditRow
              key={b.id}
              branch={b}
              onSave={(data) => updateBranch.mutate({ branchId: b.id, ...data })}
              onCancel={() => setEditingId(null)}
              isSaving={updateBranch.isPending}
            />
          ) : (
            <div key={b.id} className="flex items-start justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{b.name}</p>
                {b.address && <p className="text-xs text-muted">{b.address}</p>}
                {b.receiptHeader && <p className="text-xs text-muted italic">Header: {b.receiptHeader}</p>}
              </div>
              <button onClick={() => setEditingId(b.id)} className="text-xs text-muted hover:text-ink ml-4 shrink-0">
                Edit
              </button>
            </div>
          )
        )}
        {adding && (
          <BranchEditRow
            onSave={(data) => createBranch.mutate(data as { name: string; address?: string; receiptHeader?: string })}
            onCancel={() => setAdding(false)}
            isSaving={createBranch.isPending}
          />
        )}
      </div>
    </section>
  );
}

function BranchEditRow({
  branch,
  onSave,
  onCancel,
  isSaving,
}: {
  branch?: { name: string; address: string | null; receiptHeader: string | null };
  onSave: (data: { name: string; address?: string; receiptHeader?: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(branch?.name ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [header, setHeader] = useState(branch?.receiptHeader ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    onSave({ name: name.trim(), address: address.trim() || undefined, receiptHeader: header.trim() || undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 bg-field space-y-2">
      <div>
        <label className="block text-xs text-muted mb-1">Branch name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-line bg-field px-2 py-1.5 text-sm focus:outline-none focus:border-ink"
          placeholder="e.g. Main Store"
          autoFocus
          maxLength={100}
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full border border-line bg-field px-2 py-1.5 text-sm focus:outline-none focus:border-ink"
          placeholder="Optional"
          maxLength={200}
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Receipt header</label>
        <input
          type="text"
          value={header}
          onChange={(e) => setHeader(e.target.value)}
          className="w-full border border-line bg-field px-2 py-1.5 text-sm focus:outline-none focus:border-ink"
          placeholder="Printed at top of receipts (optional)"
          maxLength={200}
        />
      </div>
      {error && <p className="text-danger text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={isSaving} className="px-3 py-1.5 bg-ink text-paper text-sm font-semibold hover:opacity-80 disabled:opacity-50">
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 border border-line text-sm text-muted hover:bg-field hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
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
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-3">Export data</p>
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
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-danger mb-3">Danger zone</p>
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
