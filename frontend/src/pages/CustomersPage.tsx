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
    <div className="flex flex-col min-h-full">
      <div className="border-b border-line px-6 py-4 bg-paper flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-ink">Customers</h1>
          <p className="text-xs text-muted mt-0.5">Credit accounts and purchase history</p>
        </div>
        <button
          className="px-4 py-1.5 bg-ink text-paper text-sm font-semibold hover:opacity-80"
          onClick={() => setView("add")}
        >
          + Add customer
        </button>
      </div>
      <div className="px-6 py-4">
        <input
          type="search"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-line bg-field px-3 py-2 text-sm mb-4 max-w-md"
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
    <div className="flex flex-col min-h-full">
      <div className="border-b border-line px-6 py-3 bg-paper flex items-center gap-3">
        <button onClick={onBack} className="text-muted hover:text-ink text-sm leading-none">←</button>
        <h1 className="text-sm font-semibold text-ink">{data.name}</h1>
      </div>
      <div className="px-6 py-4 max-w-2xl">

      <div className="border border-line mb-4">
        <div className="flex items-start justify-between px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-ink">{data.name}</p>
            <p className="text-xs text-muted mt-0.5">{data.phone ?? "No phone"}</p>
            {data.notes && <p className="text-xs text-muted mt-1">{data.notes}</p>}
          </div>
          <div className="text-right">
            <p className={`text-xl font-mono font-bold tabular-nums ${data.balance > 0 ? "text-danger" : "text-brand"}`}>
              {data.balance > 0 ? `Owes ${formatMoney(data.balance)}` : "No balance"}
            </p>
            {data.creditLimit != null && (
              <p className="text-xs text-muted mt-0.5">Limit: {formatMoney(data.creditLimit)}</p>
            )}
          </div>
        </div>
        {data.balance > 0 && (
          <div className="border-t border-line px-5 py-3">
            <button
              className="px-4 py-1.5 bg-ink text-paper text-sm font-semibold hover:opacity-80"
              onClick={() => setShowPayment(true)}
            >
              Record payment
            </button>
          </div>
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

      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-2">Credit ledger</p>
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
    <div className="border border-line mb-4">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-ink">Record payment</p>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <div>
          <label className="block text-xs text-muted mb-1">Amount (GH₵)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={pesewas}
            onChange={(e) => setPesewas(e.target.value)}
            className="w-full border border-line bg-field px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-ink"
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
            className="w-full border border-line bg-field px-3 py-2 text-sm focus:outline-none focus:border-ink"
            maxLength={200}
          />
        </div>
        {error && <p className="text-danger text-xs">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={addPayment.isPending}
            className="flex-1 py-2 bg-ink text-paper text-sm font-semibold hover:opacity-80 disabled:opacity-50"
          >
            {addPayment.isPending ? "Saving…" : "Confirm payment"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-line text-sm text-muted hover:bg-field hover:text-ink"
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
    <div className="flex flex-col min-h-full">
      <div className="border-b border-line px-6 py-3 bg-paper flex items-center gap-3">
        <button onClick={onBack} className="text-muted hover:text-ink text-sm leading-none">←</button>
        <h1 className="text-sm font-semibold text-ink">Add customer</h1>
      </div>
      <div className="px-6 py-4 max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-line bg-field px-3 py-2 text-sm focus:outline-none focus:border-ink"
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
            className="w-full border border-line bg-field px-3 py-2 text-sm focus:outline-none focus:border-ink"
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
            className="w-full border border-line bg-field px-3 py-2 text-sm focus:outline-none focus:border-ink"
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
            className="w-full border border-line bg-field px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-ink"
            placeholder="e.g. 100.00"
          />
        </div>
        {error && <p className="text-danger text-xs">{error}</p>}
        <button
          type="submit"
          disabled={create.isPending}
          className="w-full py-2.5 bg-ink text-paper font-semibold text-sm hover:opacity-80 disabled:opacity-50"
        >
          {create.isPending ? "Saving…" : "Add customer"}
        </button>
      </form>
      </div>
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
