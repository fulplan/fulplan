import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";
import { formatMoney } from "../lib/money";

// ── Types ──────────────────────────────────────────────────────────────────

type SupplierSummary = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  balance: number;
};

// ── Main page ──────────────────────────────────────────────────────────────

export function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "add" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, refetch } = trpc.suppliers.list.useQuery({
    search: debouncedSearch || undefined,
    activeOnly: false,
  });

  function handleSelect(id: string) {
    setSelectedId(id);
    setView("detail");
  }

  if (view === "detail" && selectedId) {
    return (
      <SupplierDetail
        supplierId={selectedId}
        onBack={() => { setView("list"); setSelectedId(null); refetch(); }}
      />
    );
  }

  if (view === "add") {
    return (
      <AddSupplierForm
        onBack={() => { setView("list"); refetch(); }}
        onCreated={(id) => { setSelectedId(id); setView("detail"); refetch(); }}
      />
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Suppliers</h1>
        <button
          className="px-4 py-2 bg-ink text-paper text-sm font-semibold"
          onClick={() => setView("add")}
        >
          + Add supplier
        </button>
      </div>

      <input
        type="search"
        placeholder="Search by name or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-line px-3 py-2 text-sm mb-4"
      />

      {isLoading && <p className="text-muted text-sm">Loading…</p>}

      {!isLoading && data?.suppliers.length === 0 && (
        <div className="text-center py-16 text-muted">
          {search ? "No suppliers match your search." : "No suppliers yet — add your first one."}
        </div>
      )}

      {data && data.suppliers.length > 0 && (
        <div className="border border-line divide-y divide-line">
          {data.suppliers.map((s) => (
            <SupplierRow key={s.id} supplier={s} onSelect={() => handleSelect(s.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Supplier list row ──────────────────────────────────────────────────────

function SupplierRow({
  supplier,
  onSelect,
}: {
  supplier: SupplierSummary;
  onSelect: () => void;
}) {
  return (
    <button
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-field text-left"
      onClick={onSelect}
    >
      <div>
        <div className="font-medium text-sm">{supplier.name}</div>
        <div className="text-xs text-muted">{supplier.phone ?? supplier.email ?? "—"}</div>
      </div>
      <div className="text-right">
        {supplier.balance > 0 ? (
          <div className="text-danger font-mono font-semibold text-sm tabular-nums">
            owe {formatMoney(supplier.balance)}
          </div>
        ) : (
          <div className="text-muted text-xs">no balance</div>
        )}
      </div>
    </button>
  );
}

// ── Supplier detail + ledger ───────────────────────────────────────────────

type EntryAction = "purchase" | "payment" | null;

function SupplierDetail({ supplierId, onBack }: { supplierId: string; onBack: () => void }) {
  const [action, setAction] = useState<EntryAction>(null);
  const { data, isLoading, refetch } = trpc.suppliers.get.useQuery({ supplierId });

  if (isLoading) return <div className="p-4 text-sm text-muted">Loading…</div>;
  if (!data) return <div className="p-4 text-sm text-danger">Supplier not found.</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button className="text-sm text-muted mb-4" onClick={onBack}>
        ← Back to suppliers
      </button>

      <div className="border border-line p-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{data.name}</h2>
            <div className="text-sm text-muted">{data.phone ?? data.email ?? "No contact"}</div>
            {data.notes && <div className="text-xs text-muted mt-1">{data.notes}</div>}
          </div>
          <div className="text-right">
            <div className={`text-xl font-mono font-bold tabular-nums ${data.balance > 0 ? "text-danger" : "text-brand"}`}>
              {data.balance > 0 ? `Owe ${formatMoney(data.balance)}` : "No balance"}
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className="px-4 py-2 border border-line text-sm font-medium hover:bg-field"
            onClick={() => setAction(action === "purchase" ? null : "purchase")}
          >
            + Record purchase
          </button>
          {data.balance > 0 && (
            <button
              className="px-4 py-2 bg-brand text-paper text-sm font-semibold"
              onClick={() => setAction(action === "payment" ? null : "payment")}
            >
              Record payment
            </button>
          )}
        </div>
      </div>

      {action && (
        <EntryForm
          supplierId={supplierId}
          type={action}
          maxAmount={action === "payment" ? data.balance : undefined}
          onDone={() => { setAction(null); refetch(); }}
          onCancel={() => setAction(null)}
        />
      )}

      <h3 className="font-semibold text-sm mb-2">Ledger</h3>
      {data.entries.length === 0 ? (
        <div className="text-sm text-muted py-4 text-center">No entries yet.</div>
      ) : (
        <div className="border border-line divide-y divide-line">
          {data.entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className={`text-xs font-semibold uppercase ${e.type === "PURCHASE" ? "text-danger" : "text-brand"}`}>
                  {e.type === "PURCHASE" ? "Purchase on credit" : "Payment made"}
                </div>
                <div className="text-xs text-muted">
                  {new Date(e.createdAt).toLocaleDateString()} · {e.createdBy.name}
                </div>
                {e.note && <div className="text-xs text-muted italic">{e.note}</div>}
              </div>
              <div className={`font-mono font-semibold tabular-nums text-sm ${e.type === "PURCHASE" ? "text-danger" : "text-brand"}`}>
                {e.type === "PURCHASE" ? "+" : "−"}{formatMoney(e.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Entry form (purchase or payment) ──────────────────────────────────────

function EntryForm({
  supplierId,
  type,
  maxAmount,
  onDone,
  onCancel,
}: {
  supplierId: string;
  type: "purchase" | "payment";
  maxAmount?: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addPurchase = trpc.suppliers.addPurchase.useMutation({
    onSuccess: onDone,
    onError: (err) => setError(err.message),
  });

  const addPayment = trpc.suppliers.addPayment.useMutation({
    onSuccess: onDone,
    onError: (err) => setError(err.message),
  });

  const isPending = addPurchase.isPending || addPayment.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cedis = parseFloat(amountStr);
    if (isNaN(cedis) || cedis <= 0) { setError("Enter a valid amount"); return; }
    const amount = Math.round(cedis * 100);
    if (type === "payment" && maxAmount != null && amount > maxAmount) {
      setError(`Cannot record more than the balance (${formatMoney(maxAmount)})`);
      return;
    }
    const payload = { supplierId, amount, note: note || undefined };
    if (type === "purchase") addPurchase.mutate(payload);
    else addPayment.mutate(payload);
  }

  const label = type === "purchase" ? "Purchase amount (GH₵)" : "Payment amount (GH₵)";
  const confirmLabel = type === "purchase" ? "Record purchase" : "Confirm payment";

  return (
    <div className="border border-line p-4 mb-4 bg-field">
      <h3 className="font-semibold text-sm mb-3 capitalize">{type === "purchase" ? "Record purchase" : "Record payment"}</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-muted mb-1">{label}</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="w-full border border-line px-3 py-2 text-sm font-mono tabular-nums"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Note (optional)</label>
          <input
            type="text"
            placeholder={type === "purchase" ? "e.g. 2 cartons Cabin Biscuits" : "e.g. Mobile money payment"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-line px-3 py-2 text-sm"
            maxLength={200}
          />
        </div>
        {error && <p className="text-danger text-xs">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 py-2 bg-brand text-paper text-sm font-semibold disabled:opacity-50"
          >
            {isPending ? "Saving…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-line text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Add supplier form ──────────────────────────────────────────────────────

function AddSupplierForm({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = trpc.suppliers.create.useMutation({
    onSuccess: (result) => onCreated(result.id),
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required"); return; }
    create.mutate({
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <button className="text-sm text-muted mb-4" onClick={onBack}>
        ← Back to suppliers
      </button>
      <h2 className="text-lg font-bold mb-4">Add supplier</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-line px-3 py-2 text-sm"
            placeholder="Supplier or company name"
            maxLength={100}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-line px-3 py-2 text-sm"
            placeholder="e.g. 0244123456"
            maxLength={20}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-line px-3 py-2 text-sm"
            placeholder="e.g. orders@supplier.com"
            maxLength={100}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-line px-3 py-2 text-sm"
            placeholder="Optional"
            maxLength={500}
          />
        </div>
        {error && <p className="text-danger text-xs">{error}</p>}
        <button
          type="submit"
          disabled={create.isPending}
          className="w-full py-3 bg-ink text-paper font-semibold text-sm disabled:opacity-50"
        >
          {create.isPending ? "Saving…" : "Add supplier"}
        </button>
      </form>
    </div>
  );
}

// ── Utilities ──────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
