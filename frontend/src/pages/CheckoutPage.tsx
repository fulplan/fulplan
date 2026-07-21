import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { trpc } from '../lib/trpc';

// ── Money helpers ─────────────────────────────────────────────────────────────

function formatGhs(pesewas: number): string {
  return 'GH₵ ' + (pesewas / 100).toFixed(2);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartItem {
  productId: string;
  name: string;
  sellingPrice: number; // pesewas
  costPrice: number;    // pesewas
  saleUnit: string;
  quantity: number;
}

interface SaleResult {
  id: string;
  total: number;
  change: number;
  paymentMethod: 'CASH' | 'MOMO' | 'CREDIT';
  createdAt: Date;
  customerName?: string;
}

type ProductRow = {
  id: string;
  name: string;
  barcode: string | null;
  sellingPrice: number;
  costPrice: number;
  saleUnit: string;
  stock: number;
};

// ── Product tile ──────────────────────────────────────────────────────────────

function ProductTile({
  product,
  cartQty,
  onTap,
}: {
  product: ProductRow;
  cartQty: number;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className="relative flex flex-col justify-between border border-line bg-paper p-3 text-left hover:bg-field active:bg-line"
      style={{ minHeight: 88 }}
    >
      {cartQty > 0 && (
        <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center bg-brand px-1 text-xs font-bold text-paper">
          {cartQty}
        </span>
      )}
      <span className="pr-6 text-sm font-medium leading-snug">{product.name}</span>
      <span className="mt-2 font-mono text-sm font-semibold tabular-nums text-brand">
        {formatGhs(product.sellingPrice)}
      </span>
    </button>
  );
}

// ── Cart panel ────────────────────────────────────────────────────────────────

function CartPanel({
  items,
  total,
  onSetQty,
  onRemove,
  onCharge,
}: {
  items: CartItem[];
  total: number;
  onSetQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onCharge: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b-2 border-ink px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Cart
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-muted">Tap a product to add it</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {items.map((item) => (
            <div key={item.productId} className="border-b border-line px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <span className="flex-1 text-sm font-medium leading-snug">
                  {item.name}
                </span>
                <button
                  onClick={() => onRemove(item.productId)}
                  className="shrink-0 text-sm text-muted hover:text-danger"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center border border-line">
                  <button
                    onClick={() => onSetQty(item.productId, item.quantity - 1)}
                    className="w-8 py-1 text-center text-base hover:bg-field active:bg-line"
                    style={{ height: 'var(--spacing-touch-sm, 40px)' }}
                  >
                    −
                  </button>
                  <span className="w-8 py-1 text-center text-sm font-semibold tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onSetQty(item.productId, item.quantity + 1)}
                    className="w-8 py-1 text-center text-base hover:bg-field active:bg-line"
                    style={{ height: 'var(--spacing-touch-sm, 40px)' }}
                  >
                    +
                  </button>
                </div>
                <span className="font-mono text-sm tabular-nums">
                  {formatGhs(item.sellingPrice * item.quantity)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t-2 border-ink px-4 py-4">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide text-muted">
            Total
          </span>
          <span className="font-mono text-2xl font-bold tabular-nums">
            {formatGhs(total)}
          </span>
        </div>
        <button
          onClick={onCharge}
          disabled={items.length === 0}
          className="w-full bg-brand py-4 text-base font-semibold text-paper disabled:opacity-30 hover:opacity-90"
        >
          Charge {formatGhs(total)}
        </button>
      </div>
    </div>
  );
}

// ── Customer picker (used inside PaymentModal for credit sales) ───────────────

function CustomerPicker({
  value,
  onChange,
}: {
  value: { id: string; name: string; balance: number; creditLimit: number | null } | null;
  onChange: (c: { id: string; name: string; balance: number; creditLimit: number | null } | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const { data } = trpc.customers.list.useQuery(
    { search: search || undefined, activeOnly: true, limit: 20 },
    { enabled: open },
  );

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-sm font-medium">Customer</label>
      {value ? (
        <div className="flex items-center justify-between border-2 border-ink bg-field px-3 py-2">
          <div>
            <span className="text-sm font-semibold">{value.name}</span>
            {value.balance > 0 && (
              <span className="ml-2 text-xs text-danger">
                owes {formatGhs(value.balance)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); setSearch(''); setOpen(false); }}
            className="text-sm text-muted hover:text-danger"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="search"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="w-full border-2 border-ink bg-field px-3 py-2 text-sm focus:outline-none"
          />
          {open && data && data.customers.length > 0 && (
            <div className="absolute z-10 w-full border border-line bg-paper shadow-md">
              {data.customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-field"
                  onClick={() => {
                    onChange({ id: c.id, name: c.name, balance: c.balance, creditLimit: c.creditLimit });
                    setSearch('');
                    setOpen(false);
                  }}
                >
                  <span>{c.name}{c.phone ? ` · ${c.phone}` : ''}</span>
                  {c.balance > 0 && (
                    <span className="text-xs text-danger">owes {formatGhs(c.balance)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {open && data && data.customers.length === 0 && search && (
            <div className="absolute z-10 w-full border border-line bg-paper px-3 py-2 text-sm text-muted shadow-md">
              No customers found — add them in the Customers page.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Payment modal ─────────────────────────────────────────────────────────────

function PaymentModal({
  total,
  branchId,
  cartItems,
  onComplete,
  onClose,
}: {
  total: number;
  branchId: string;
  cartItems: CartItem[];
  onComplete: (sale: SaleResult) => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<'CASH' | 'MOMO' | 'CREDIT'>('CASH');
  const [tenderedStr, setTenderedStr] = useState('');
  const [error, setError] = useState('');
  const [customer, setCustomer] = useState<{
    id: string; name: string; balance: number; creditLimit: number | null;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [method]);

  const completeMutation = trpc.sales.complete.useMutation({
    onSuccess(data) {
      onComplete({
        ...data,
        paymentMethod: data.paymentMethod as 'CASH' | 'MOMO' | 'CREDIT',
        createdAt: new Date(data.createdAt),
        customerName: customer?.name,
      });
    },
    onError(err) {
      setError(err.message);
    },
  });

  const tenderedPesewas = Math.round(parseFloat(tenderedStr || '0') * 100);
  const change = method === 'CASH' ? Math.max(0, tenderedPesewas - total) : 0;

  // Credit limit warning: warn if this sale would push balance over limit
  const newBalance = customer ? customer.balance + total : 0;
  const overLimit = customer?.creditLimit != null && newBalance > customer.creditLimit;

  const canConfirm =
    method === 'MOMO' ||
    method === 'CREDIT' ||
    (tenderedPesewas >= total && tenderedPesewas > 0);

  function confirm() {
    if (!canConfirm) return;
    if (method === 'CREDIT' && !customer) {
      setError('Select a customer for a credit sale');
      return;
    }
    setError('');
    completeMutation.mutate({
      branchId,
      paymentMethod: method,
      amountTendered: method === 'CASH' ? tenderedPesewas : 0,
      customerId: method === 'CREDIT' ? customer!.id : undefined,
      items: cartItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 md:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm border-2 border-ink bg-paper">
        <div className="border-b-2 border-ink px-5 py-4">
          <h2 className="text-lg font-semibold">Complete sale</h2>
          <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums">
            {formatGhs(total)}
          </p>
        </div>

        <div className="px-5 py-4">
          {/* Payment method toggle */}
          <div className="mb-5 grid grid-cols-3 border-2 border-ink">
            {(['CASH', 'MOMO', 'CREDIT'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMethod(m); setError(''); }}
                className={[
                  'py-3 text-sm font-semibold transition-colors',
                  method === m ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-field',
                ].join(' ')}
              >
                {m === 'CASH' ? 'Cash' : m === 'MOMO' ? 'MoMo' : 'Credit'}
              </button>
            ))}
          </div>

          {/* Cash: amount tendered */}
          {method === 'CASH' && (
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium">
                Amount tendered (GH₵)
              </label>
              <input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder={(total / 100).toFixed(2)}
                value={tenderedStr}
                onChange={(e) => { setTenderedStr(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && confirm()}
                className="w-full border-2 border-ink bg-field px-3 py-2 text-lg font-mono tabular-nums focus:outline-none"
              />
              {tenderedPesewas >= total && tenderedPesewas > 0 && (
                <div className="mt-3 flex justify-between border border-brand bg-paper px-3 py-2">
                  <span className="text-sm font-medium">Change</span>
                  <span className="font-mono text-sm font-bold tabular-nums text-brand">
                    {formatGhs(change)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MoMo: no amount needed */}
          {method === 'MOMO' && (
            <div className="mb-4 border border-line bg-field px-4 py-3">
              <p className="text-sm text-muted">
                Record once the customer confirms the MoMo transfer.
              </p>
            </div>
          )}

          {/* Credit: customer picker + limit warning */}
          {method === 'CREDIT' && (
            <div className="mb-4">
              <CustomerPicker value={customer} onChange={setCustomer} />
              {customer && overLimit && (
                <div className="border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Warning: this sale would bring their balance to {formatGhs(newBalance)},
                  over their {formatGhs(customer.creditLimit!)} limit.
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mb-3 text-sm text-danger">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              disabled={completeMutation.isPending}
              className="border-2 border-ink py-3 text-sm font-semibold hover:bg-field disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={!canConfirm || completeMutation.isPending}
              className="bg-brand py-3 text-sm font-semibold text-paper disabled:opacity-30 hover:opacity-90"
            >
              {completeMutation.isPending ? 'Saving…' : 'Confirm ✓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Receipt summary (post-sale) ────────────────────────────────────────────────

function ReceiptSummary({
  sale,
  shopName,
  onNewSale,
}: {
  sale: SaleResult;
  shopName: string;
  onNewSale: () => void;
}) {
  const receiptUrl = `${window.location.origin}/receipt/${sale.id}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`Your receipt from ${shopName}: ${receiptUrl}`)}`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm border-2 border-brand">
        <div className="border-b-2 border-brand bg-brand px-5 py-5 text-paper">
          <p className="text-4xl font-bold">✓</p>
          <p className="mt-1 text-xl font-semibold">Sale complete</p>
        </div>
        <div className="px-5 py-5">
          <div className="space-y-2">
            <Row label="Total" value={formatGhs(sale.total)} bold />
            {sale.paymentMethod === 'CASH' && sale.change > 0 && (
              <Row label="Change" value={formatGhs(sale.change)} />
            )}
            <Row
              label="Method"
              value={sale.paymentMethod === 'CASH' ? 'Cash' : sale.paymentMethod === 'MOMO' ? 'MoMo' : 'Credit'}
            />
            {sale.customerName && (
              <Row label="Customer" value={sale.customerName} />
            )}
            <Row
              label="Time"
              value={sale.createdAt.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center border border-line py-3 text-sm font-medium hover:bg-field"
            >
              View receipt
            </a>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center bg-brand py-3 text-sm font-semibold text-paper hover:opacity-90"
            >
              Share via WA
            </a>
          </div>

          <button
            onClick={onNewSale}
            className="mt-3 w-full bg-ink py-4 text-base font-semibold text-paper hover:opacity-90"
            autoFocus
          >
            New sale
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className={['font-mono text-sm tabular-nums', bold ? 'font-bold text-base' : ''].join(' ')}>
        {value}
      </span>
    </div>
  );
}

// ── Mobile cart bar ───────────────────────────────────────────────────────────

function MobileCartBar({
  itemCount,
  total,
  onExpand,
  onCharge,
}: {
  itemCount: number;
  total: number;
  onExpand: () => void;
  onCharge: () => void;
}) {
  if (itemCount === 0) return null;
  return (
    <div className="flex items-center justify-between border-t-2 border-ink bg-paper px-4 py-3 md:hidden">
      <button onClick={onExpand} className="text-sm font-medium">
        {itemCount} item{itemCount !== 1 ? 's' : ''} &middot; {formatGhs(total)}
      </button>
      <button
        onClick={onCharge}
        className="bg-brand px-5 py-2.5 text-sm font-semibold text-paper hover:opacity-90"
      >
        Charge {formatGhs(total)}
      </button>
    </div>
  );
}

// ── Mobile cart overlay ────────────────────────────────────────────────────────

function MobileCartOverlay({
  items,
  total,
  onSetQty,
  onRemove,
  onCharge,
  onClose,
}: {
  items: CartItem[];
  total: number;
  onSetQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onCharge: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-paper md:hidden">
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
        <h2 className="text-base font-semibold">Cart</h2>
        <button onClick={onClose} className="text-sm text-muted underline">
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <CartPanel
          items={items}
          total={total}
          onSetQty={onSetQty}
          onRemove={onRemove}
          onCharge={() => { onClose(); onCharge(); }}
        />
      </div>
    </div>
  );
}

// ── Main checkout page ────────────────────────────────────────────────────────

export function CheckoutPage() {
  const { user } = useAuth();
  const branchId = user?.branchId ?? '';

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);

  // Product search
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const productsQuery = trpc.products.list.useQuery(
    { branchId: branchId || undefined },
    { staleTime: 60_000 },
  );

  const products: ProductRow[] = useMemo(() => {
    return (productsQuery.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      sellingPrice: p.sellingPrice,
      costPrice: p.costPrice,
      saleUnit: p.saleUnit,
      stock: p.stockQuantity ?? 0,
    }));
  }, [productsQuery.data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q)),
    );
  }, [products, search]);

  // ── USB barcode scanner support ─────────────────────────────────────────────
  // USB scanners emit keystrokes then Enter.  Accumulate when no input is focused.
  useEffect(() => {
    let buffer = '';
    let timeout: ReturnType<typeof setTimeout>;

    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'Enter') {
        if (buffer) {
          const match = products.find((p) => p.barcode === buffer);
          if (match) addToCart(match);
          else {
            // Fall back to putting the barcode in the search box
            setSearch(buffer);
            searchRef.current?.focus();
          }
          buffer = '';
          clearTimeout(timeout);
        }
        return;
      }

      if (e.key.length === 1) {
        buffer += e.key;
        clearTimeout(timeout);
        // Reset buffer if no Enter within 200 ms (human typing, not scanner)
        timeout = setTimeout(() => { buffer = ''; }, 200);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  // ── Cart operations ─────────────────────────────────────────────────────────

  function addToCart(product: ProductRow) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sellingPrice: product.sellingPrice,
          costPrice: product.costPrice,
          saleUnit: product.saleUnit,
          quantity: 1,
        },
      ];
    });
  }

  function setQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
    } else {
      setCart((prev) =>
        prev.map((i) =>
          i.productId === productId ? { ...i, quantity: qty } : i,
        ),
      );
    }
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  const cartTotal = cart.reduce(
    (sum, i) => sum + i.sellingPrice * i.quantity,
    0,
  );
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  function handleSaleComplete(sale: SaleResult) {
    setShowPayment(false);
    setLastSale(sale);
    productsQuery.refetch(); // refresh stock counts
  }

  function startNewSale() {
    setLastSale(null);
    setCart([]);
    searchRef.current?.focus();
  }

  // ── Receipt screen ──────────────────────────────────────────────────────────
  if (lastSale) {
    return (
      <div className="flex h-[calc(100dvh-49px)] flex-col">
        <ReceiptSummary
          sale={lastSale}
          shopName={user?.organizationName ?? ''}
          onNewSale={startNewSale}
        />
      </div>
    );
  }

  // ── Main checkout layout ────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100dvh-49px)] flex-col">
      <div className="flex flex-1 min-h-0">
        {/* ── Left: product grid ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Search */}
          <div className="border-b border-line px-3 py-2">
            <input
              ref={searchRef}
              type="search"
              placeholder="Search products or scan barcode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-field border border-line px-3 py-2 text-sm focus:outline-none focus:border-ink"
            />
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {productsQuery.isPending ? (
              <p className="text-sm text-muted">Loading products…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted">
                {search ? 'No products match.' : 'No products yet — add them in the Products tab.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((p) => (
                  <ProductTile
                    key={p.id}
                    product={p}
                    cartQty={cart.find((i) => i.productId === p.id)?.quantity ?? 0}
                    onTap={() => addToCart(p)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Mobile cart bar */}
          <MobileCartBar
            itemCount={cartCount}
            total={cartTotal}
            onExpand={() => setShowMobileCart(true)}
            onCharge={() => setShowPayment(true)}
          />
        </div>

        {/* ── Right: cart sidebar (desktop) ── */}
        <div className="hidden w-72 shrink-0 border-l-2 border-ink md:flex md:flex-col">
          <CartPanel
            items={cart}
            total={cartTotal}
            onSetQty={setQty}
            onRemove={removeFromCart}
            onCharge={() => setShowPayment(true)}
          />
        </div>
      </div>

      {/* Mobile full-screen cart */}
      {showMobileCart && (
        <MobileCartOverlay
          items={cart}
          total={cartTotal}
          onSetQty={setQty}
          onRemove={removeFromCart}
          onCharge={() => setShowPayment(true)}
          onClose={() => setShowMobileCart(false)}
        />
      )}

      {/* Payment modal */}
      {showPayment && (
        <PaymentModal
          total={cartTotal}
          branchId={branchId}
          cartItems={cart}
          onComplete={handleSaleComplete}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}
