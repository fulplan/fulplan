import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";
import { formatMoney } from "../lib/money";

// ── Types ──────────────────────────────────────────────────────────────────

type CustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
  creditLimit: number | null;
  active: boolean;
  salesCount: number;
  balance: number;
};

// ── Main page ──────────────────────────────────────────────────────────────

export function CustomersPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "add" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, refetch } = trpc.customers.list.useQuery({
    search: debouncedSearch || undefined,
    activeOnly: false,
  });

  function handleSelect(id: string) {
    setSelectedId(id);
    setView("detail");
  }

  if (view === "detail" && selectedId) {
    return (
      <CustomerDetail
        customerId={selectedId}
        onBack={() => { setView("list"); setSelectedId(null); refetch(); }}
      />
    );
  }

  if (view === "add") {
    return (
      <AddCustomerForm
        onBack={() => { setView("list"); refetch(); }}
        onCreated={(id) => { setSelectedId(id); setView("detail"); refetch(); }}
      />
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Customers</h1>
        <button
          className="px-4 py-2 bg-ink text-paper text-sm font-semibold"
          onClick={() => setView("add")}
        >
          + Add customer
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

      {!isLoading && data?.customers.length === 0 && (
        <div className="text-center py-16 text-muted">
          {search ? "No customers match your search." : "No customers yet — add your first one."}
        </div>
      )}

      {data && data.customers.length > 0 && (
        <div className="border border-line divide-y divide-line">
          {data.customers.map((c) => (
            <CustomerRow key={c.id} customer={c} onSelect={() => handleSelect(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Customer list row ──────────────────────────────────────────────────────

function CustomerRow({
  customer,
  onSelect,
}: {
  customer: CustomerSummary;
  onSelect: () => void;
}) {
  return (
    <button
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-field text-left"
      onClick={onSelect}
    >
      <div>
        <div className="font-medium text-sm">{customer.name}</div>
        <div className="text-xs text-muted">{customer.phone ?? "—"}</div>
      </div>
      <div className="text-right">
        {customer.balance > 0 ? (
          <div className="text-danger font-mono font-semibold text-sm tabular-nums">
            owes {formatMoney(customer.balance)}
          </div>
        ) : (
          <div className="text-muted text-xs">no balance</div>
        )}
        <div className="text-xs text-muted">{customer.salesCount} sales</div>
      </div>
    </button>
  );
}

// ── Customer detail + ledger + payment ────────────────────────────────────

function CustomerDetail({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const [showPayment, setShowPayment] = useState(false);
  const { data, isLoading, refetch } = trpc.customers.get.useQuery({ customerId });

  if (isLoading) return <div className="p-4 text-sm text-muted">Loading…</div>;
  if (!data) return <div className="p-4 text-sm text-danger">Customer not found.</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button className="text-sm text-muted mb-4" onClick={onBack}>
        ← Back to customers
      </button>

      <div className="border border-line p-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{data.name}</h2>
            <div className="text-sm text-muted">{data.phone ?? "No phone"}</div>
            {data.notes && <div className="text-xs text-muted mt-1">{data.notes}</div>}
          </div>
          <div className="text-right">
            <div className={`text-xl font-mono font-bold tabular-nums ${data.balance > 0 ? "text-danger" : "text-brand"}`}>
              {data.balance > 0 ? `Owes ${formatMoney(data.balance)}` : "No balance"}
            </div>
            {data.creditLimit != null && (
              <div className="text-xs text-muted">Limit: {formatMoney(data.creditLimit)}</div>
            )}
          </div>
        </div>
        {data.balance > 0 && (
          <button
            className="mt-3 px-4 py-2 bg-brand text-paper text-sm font-semibold"
            onClick={() => setShowPayment(true)}
          >
            Record payment
          </button>
        )}
      </div>

      {showPayment && (
        <RecordPaymentForm
          customerId={customerId}
          maxAmount={data.balance}
          onDone={() => { setShowPayment(false); refetch(); }}
          onCancel={() => setShowPayment(false)}
        />
      )}

      <h3 className="font-semibold text-sm mb-2">Credit ledger</h3>
      {data.entries.length === 0 ? (
        <div className="text-sm text-muted py-4 text-center">No credit activity yet.</div>
      ) : (
        <div className="border border-line divide-y divide-line">
          {data.entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className={`text-xs font-semibold uppercase ${e.type === "CHARGE" ? "text-danger" : "text-brand"}`}>
                  {e.type === "CHARGE" ? "Sale on credit" : "Payment received"}
                </div>
                <div className="text-xs text-muted">
                  {new Date(e.createdAt).toLocaleDateString()} · {e.createdBy.name}
                </div>
                {e.note && <div className="text-xs text-muted italic">{e.note}</div>}
              </div>
              <div className={`font-mono font-semibold tabular-nums text-sm ${e.type === "CHARGE" ? "text-danger" : "text-brand"}`}>
                {e.type === "CHARGE" ? "+" : "−"}{formatMoney(e.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Record payment form ────────────────────────────────────────────────────

function RecordPaymentForm({
  customerId,
  maxAmount,
  onDone,
  onCancel,
}: {
  customerId: string;
  maxAmount: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pesewas, setPesewas] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addPayment = trpc.customers.addPayment.useMutation({
    onSuccess: onDone,
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cedis = parseFloat(pesewas);
    if (isNaN(cedis) || cedis <= 0) {
      setError("Enter a valid amount");
      return;
    }
    const amount = Math.round(cedis * 100);
    if (amount > maxAmount) {
      setError(`Cannot record more than the balance (${formatMoney(maxAmount)})`);
      return;
    }
    addPayment.mutate({ customerId, amount, note: note || undefined });
  }

  return (
    <div className="border border-line p-4 mb-4 bg-field">
      <h3 className="font-semibold text-sm mb-3">Record payment</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-muted mb-1">Amount (GH₵)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={pesewas}
            onChange={(e) => setPesewas(e.target.value)}
            className="w-full border border-line px-3 py-2 text-sm font-mono tabular-nums"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Note (optional)</label>
          <input
            type="text"
            placeholder="e.g. Cash payment"
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
            disabled={addPayment.isPending}
            className="flex-1 py-2 bg-brand text-paper text-sm font-semibold disabled:opacity-50"
          >
            {addPayment.isPending ? "Saving…" : "Confirm payment"}
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

// ── Add customer form ──────────────────────────────────────────────────────

function AddCustomerForm({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [limitText, setLimitText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = trpc.customers.create.useMutation({
    onSuccess: (result) => onCreated(result.id),
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required"); return; }
    const creditLimit = limitText
      ? Math.round(parseFloat(limitText) * 100)
      : undefined;
    if (limitText && (isNaN(creditLimit!) || creditLimit! < 0)) {
      setError("Enter a valid credit limit"); return;
    }
    create.mutate({
      name: name.trim(),
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      creditLimit,
    });
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <button className="text-sm text-muted mb-4" onClick={onBack}>
        ← Back to customers
      </button>
      <h2 className="text-lg font-bold mb-4">Add customer</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-line px-3 py-2 text-sm"
            placeholder="Customer name"
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
        <div>
          <label className="block text-xs text-muted mb-1">
            Credit limit (GH₵) — leave blank for unlimited
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={limitText}
            onChange={(e) => setLimitText(e.target.value)}
            className="w-full border border-line px-3 py-2 text-sm font-mono tabular-nums"
            placeholder="e.g. 100.00"
          />
        </div>
        {error && <p className="text-danger text-xs">{error}</p>}
        <button
          type="submit"
          disabled={create.isPending}
          className="w-full py-3 bg-ink text-paper font-semibold text-sm disabled:opacity-50"
        >
          {create.isPending ? "Saving…" : "Add customer"}
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
