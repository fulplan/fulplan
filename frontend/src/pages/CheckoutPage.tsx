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
  paymentMethod: 'CASH' | 'MOMO';
  createdAt: Date;
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
  const [method, setMethod] = useState<'CASH' | 'MOMO'>('CASH');
  const [tenderedStr, setTenderedStr] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [method]);

  const completeMutation = trpc.sales.complete.useMutation({
    onSuccess(data) {
      onComplete({
        ...data,
        paymentMethod: data.paymentMethod as 'CASH' | 'MOMO',
        createdAt: new Date(data.createdAt),
      });
    },
    onError(err) {
      setError(err.message);
    },
  });

  const tenderedPesewas = Math.round(parseFloat(tenderedStr || '0') * 100);
  const change = method === 'CASH' ? Math.max(0, tenderedPesewas - total) : 0;
  const canConfirm =
    method === 'MOMO' ||
    (tenderedPesewas >= total && tenderedPesewas > 0);

  function confirm() {
    if (!canConfirm) return;
    setError('');
    completeMutation.mutate({
      branchId,
      paymentMethod: method,
      amountTendered: method === 'MOMO' ? total : tenderedPesewas,
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
          <div className="mb-5 grid grid-cols-2 border-2 border-ink">
            {(['CASH', 'MOMO'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMethod(m); setError(''); }}
                className={[
                  'py-3 text-sm font-semibold transition-colors',
                  method === m ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-field',
                ].join(' ')}
              >
                {m === 'CASH' ? 'Cash' : 'MoMo'}
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
  onNewSale,
}: {
  sale: SaleResult;
  onNewSale: () => void;
}) {
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
            <Row label="Method" value={sale.paymentMethod === 'CASH' ? 'Cash' : 'MoMo'} />
            <Row
              label="Time"
              value={sale.createdAt.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          </div>
          <button
            onClick={onNewSale}
            className="mt-6 w-full bg-ink py-4 text-base font-semibold text-paper hover:opacity-90"
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
        <ReceiptSummary sale={lastSale} onNewSale={startNewSale} />
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
