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
    <div className="flex flex-col min-h-full">
      <div className="border-b border-line px-6 py-4 bg-paper flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-ink">Suppliers</h1>
          <p className="text-xs text-muted mt-0.5">Manage suppliers and purchase credit</p>
        </div>
        <button
          className="px-4 py-1.5 bg-ink text-paper text-sm font-semibold hover:opacity-80"
          onClick={() => setView("add")}
        >
          + Add supplier
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

type EntryAction = "receive" | "purchase" | "payment" | null;

function SupplierDetail({ supplierId, onBack }: { supplierId: string; onBack: () => void }) {
  const [action, setAction] = useState<EntryAction>(null);
  const { data, isLoading, refetch } = trpc.suppliers.get.useQuery({ supplierId });

  if (isLoading) return <div className="p-4 text-sm text-muted">Loading…</div>;
  if (!data) return <div className="p-4 text-sm text-danger">Supplier not found.</div>;

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
            <p className="text-xs text-muted mt-0.5">{data.phone ?? data.email ?? "No contact"}</p>
            {data.notes && <p className="text-xs text-muted mt-1">{data.notes}</p>}
          </div>
          <div className="text-right">
            <p className={`text-xl font-mono font-bold tabular-nums ${data.balance > 0 ? "text-danger" : "text-brand"}`}>
              {data.balance > 0 ? `Owe ${formatMoney(data.balance)}` : "No balance"}
            </p>
          </div>
        </div>
        <div className="border-t border-line px-5 py-3 flex flex-wrap gap-2">
          <button
            className="px-3 py-1.5 bg-ink text-paper text-sm font-semibold hover:opacity-80"
            onClick={() => setAction(action === "receive" ? null : "receive")}
          >
            Receive stock
          </button>
          <button
            className="px-3 py-1.5 border border-line text-sm text-muted hover:bg-field hover:text-ink"
            onClick={() => setAction(action === "purchase" ? null : "purchase")}
          >
            + Record purchase
          </button>
          {data.balance > 0 && (
            <button
              className="px-3 py-1.5 border border-line text-sm text-muted hover:bg-field hover:text-ink"
              onClick={() => setAction(action === "payment" ? null : "payment")}
            >
              Record payment
            </button>
          )}
        </div>
      </div>

      {action === "receive" && (
        <ReceiveStockForm
          supplierId={supplierId}
          supplierName={data.name}
          onDone={() => { setAction(null); refetch(); }}
          onCancel={() => setAction(null)}
        />
      )}
      {(action === "purchase" || action === "payment") && (
        <EntryForm
          supplierId={supplierId}
          type={action}
          maxAmount={action === "payment" ? data.balance : undefined}
          onDone={() => { setAction(null); refetch(); }}
          onCancel={() => setAction(null)}
        />
      )}

      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-2">Ledger</p>
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
    <div className="border border-line mb-4">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-ink">{type === "purchase" ? "Record purchase" : "Record payment"}</p>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
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
            className="flex-1 py-2 bg-ink text-paper text-sm font-semibold hover:opacity-80 disabled:opacity-50"
          >
            {isPending ? "Saving…" : confirmLabel}
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

// ── Receive stock form ────────────────────────────────────────────────────────

interface ReceiveLine {
  productId: string;
  productName: string;
  quantity: number;
  costPrice: number; // pesewas
}

function ReceiveStockForm({
  supplierId,
  supplierName,
  onDone,
  onCancel,
}: {
  supplierId: string;
  supplierName: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: productsData } = trpc.products.list.useQuery({ branchId: undefined });

  const [branchId, setBranchId] = useState<string>('');
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [onCredit, setOnCredit] = useState(false);
  const [note, setNote] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const products = productsData ?? [];
  const filteredProducts = productSearch
    ? products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : [];

  // Auto-select first branch
  useEffect(() => {
    if (branches && branches.length > 0 && !branchId) {
      setBranchId(branches[0]!.id);
    }
  }, [branches]);

  const receive = trpc.suppliers.receiveStock.useMutation({
    onSuccess: onDone,
    onError: (err) => setError(err.message),
  });

  function addLine(p: typeof products[0]) {
    setProductSearch('');
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { productId: p.id, productName: p.name, quantity: 1, costPrice: p.costPrice }];
    });
  }

  function updateLine(idx: number, field: 'quantity' | 'costPrice', raw: string) {
    const val = parseInt(field === 'costPrice' ? String(Math.round(parseFloat(raw) * 100)) : raw, 10);
    if (isNaN(val) || val < 0) return;
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: field === 'costPrice' ? Math.round(parseFloat(raw) * 100) : val } : l)));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!branchId) { setError('Select a branch'); return; }
    if (lines.length === 0) { setError('Add at least one item'); return; }
    receive.mutate({
      supplierId,
      branchId,
      items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, costPrice: l.costPrice })),
      onCredit,
      note: note.trim() || undefined,
    });
  }

  const totalValue = lines.reduce((s, l) => s + l.costPrice * l.quantity, 0);

  return (
    <div className="border border-line mb-4">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-ink">Receive stock from {supplierName}</p>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">

        {/* Branch */}
        {branches && branches.length > 1 && (
          <div>
            <label className="block text-xs text-muted mb-1">Branch *</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full border border-line px-3 py-2 text-sm bg-paper"
            >
              <option value="">Select branch…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Product search to add lines */}
        <div>
          <label className="block text-xs text-muted mb-1">Add product</label>
          <input
            type="search"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Search by product name…"
            className="w-full border border-line px-3 py-2 text-sm"
          />
          {filteredProducts.length > 0 && (
            <div className="border border-line bg-paper divide-y divide-line max-h-40 overflow-y-auto">
              {filteredProducts.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addLine(p)}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-field flex justify-between"
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-muted font-mono">GH₵ {(p.costPrice / 100).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lines */}
        {lines.length > 0 && (
          <div className="border border-line divide-y divide-line">
            <div className="grid grid-cols-[1fr_80px_100px_28px] gap-2 px-2 py-1 bg-field text-xs text-muted font-semibold uppercase">
              <span>Product</span><span className="text-right">Qty</span><span className="text-right">Cost (GH₵)</span><span />
            </div>
            {lines.map((l, i) => (
              <div key={l.productId} className="grid grid-cols-[1fr_80px_100px_28px] gap-2 px-2 py-2 items-center">
                <span className="text-sm truncate">{l.productName}</span>
                <input
                  type="number"
                  min="1"
                  value={l.quantity}
                  onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                  className="border border-line px-1 py-1 text-sm text-right tabular-nums font-mono w-full"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={(l.costPrice / 100).toFixed(2)}
                  onChange={(e) => updateLine(i, 'costPrice', e.target.value)}
                  className="border border-line px-1 py-1 text-sm text-right tabular-nums font-mono w-full"
                />
                <button type="button" onClick={() => removeLine(i)} className="text-danger text-sm">×</button>
              </div>
            ))}
            <div className="px-2 py-1 text-right text-xs font-semibold">
              Total: GH₵ {(totalValue / 100).toFixed(2)}
            </div>
          </div>
        )}

        {/* On-credit toggle */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onCredit}
            onChange={(e) => setOnCredit(e.target.checked)}
            className="w-4 h-4"
          />
          Record as credit (add to supplier balance)
        </label>

        {/* Note */}
        <div>
          <label className="block text-xs text-muted mb-1">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Invoice #1234"
            className="w-full border border-line px-3 py-2 text-sm"
            maxLength={200}
          />
        </div>

        {error && <p className="text-danger text-xs">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={receive.isPending}
            className="flex-1 py-2 bg-ink text-paper text-sm font-semibold disabled:opacity-50"
          >
            {receive.isPending ? "Saving…" : `Receive ${lines.length} item${lines.length !== 1 ? 's' : ''}`}
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2 border border-line text-sm text-muted hover:bg-field hover:text-ink">
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
    <div className="flex flex-col min-h-full">
      <div className="border-b border-line px-6 py-3 bg-paper flex items-center gap-3">
        <button onClick={onBack} className="text-muted hover:text-ink text-sm leading-none">←</button>
        <h1 className="text-sm font-semibold text-ink">Add supplier</h1>
      </div>
      <div className="px-6 py-4 max-w-md">
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
          className="w-full py-2.5 bg-ink text-paper font-semibold text-sm hover:opacity-80 disabled:opacity-50"
        >
          {create.isPending ? "Saving…" : "Add supplier"}
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
