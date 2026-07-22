import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { trpc } from '../lib/trpc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pesewasToDisplay(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

function displayToPesewas(display: string): number {
  const n = parseFloat(display);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function formatGhs(pesewas: number) {
  return `GH₵ ${pesewasToDisplay(pesewas)}`;
}

// ─── Price input ──────────────────────────────────────────────────────────────

function PriceInput({
  label,
  pesewas,
  onChange,
}: {
  label: string;
  pesewas: number;
  onChange: (p: number) => void;
}) {
  const [raw, setRaw] = useState(pesewasToDisplay(pesewas));

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div className="flex items-center border border-line bg-field">
        <span className="px-2 text-sm text-muted">GH₵</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            onChange(displayToPesewas(e.target.value));
          }}
          className="flex-1 bg-field py-2.5 pr-3 text-base tabular"
        />
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductFormState {
  name: string;
  barcode: string;
  categoryId: string;
  purchaseUnit: string;
  saleUnit: string;
  unitsPerPurchase: number;
  costPrice: number;
  sellingPrice: number;
  lowStockThreshold: number;
  initialStock: number;
  branchId: string;
}

function emptyForm(branchId: string): ProductFormState {
  return {
    name: '',
    barcode: '',
    categoryId: '',
    purchaseUnit: 'unit',
    saleUnit: 'unit',
    unitsPerPurchase: 1,
    costPrice: 0,
    sellingPrice: 0,
    lowStockThreshold: 5,
    initialStock: 0,
    branchId,
  };
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────

function ProductModal({
  editId,
  defaultBranchId,
  onClose,
}: {
  editId: string | null;
  defaultBranchId: string;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const categories = trpc.categories.list.useQuery();
  const branches = trpc.branches.list.useQuery();
  const [form, setForm] = useState<ProductFormState>(() => emptyForm(defaultBranchId));
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');
  const [showUnitFields, setShowUnitFields] = useState(false);

  const createCategory = trpc.categories.create.useMutation({
    onSuccess(cat) {
      utils.categories.list.invalidate();
      set('categoryId', cat.id);
      setNewCategory('');
    },
    onError(e) { setError(e.message); },
  });

  const createProduct = trpc.products.create.useMutation({
    onSuccess() {
      utils.products.list.invalidate();
      onClose();
    },
    onError(e) { setError(e.message); },
  });

  function set<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.sellingPrice === 0) {
      setError('Selling price must be greater than zero');
      return;
    }
    createProduct.mutate({
      name: form.name.trim(),
      barcode: form.barcode.trim() || undefined,
      categoryId: form.categoryId || undefined,
      purchaseUnit: form.purchaseUnit,
      saleUnit: form.saleUnit,
      unitsPerPurchase: form.unitsPerPurchase,
      costPrice: form.costPrice,
      sellingPrice: form.sellingPrice,
      lowStockThreshold: form.lowStockThreshold,
      initialStock: form.initialStock > 0 ? form.initialStock : undefined,
      branchId: form.initialStock > 0 ? form.branchId : undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-16 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-paper border border-line shadow-lg">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">
            {editId ? 'Edit product' : 'Add product'}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-lg leading-none">
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="divide-y divide-line">
          <div className="space-y-4 p-4">
            {/* Name */}
            <div>
              <label className="mb-1 block text-sm font-medium">Product name</label>
              <input
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="block w-full border border-line bg-field px-3 py-2.5 text-base"
              />
            </div>

            {/* Barcode */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Barcode <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                value={form.barcode}
                onChange={(e) => set('barcode', e.target.value)}
                className="block w-full border border-line bg-field px-3 py-2.5 text-base"
              />
            </div>

            {/* Category */}
            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <div className="flex gap-2">
                <select
                  value={form.categoryId}
                  onChange={(e) => set('categoryId', e.target.value)}
                  className="flex-1 border border-line bg-field px-3 py-2.5 text-base"
                >
                  <option value="">— None —</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {/* Quick add category */}
              <div className="mt-1.5 flex gap-2">
                <input
                  placeholder="New category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 border border-line bg-field px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={!newCategory.trim() || createCategory.isPending}
                  onClick={() => createCategory.mutate({ name: newCategory.trim() })}
                  className="border border-line px-3 py-2 text-sm hover:bg-field disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Prices */}
          <div className="space-y-4 p-4">
            <PriceInput
              label="Cost price (what you paid)"
              pesewas={form.costPrice}
              onChange={(p) => set('costPrice', p)}
            />
            <PriceInput
              label="Selling price"
              pesewas={form.sellingPrice}
              onChange={(p) => set('sellingPrice', p)}
            />
            {form.costPrice > 0 && form.sellingPrice > 0 && (
              <p className="text-xs text-muted">
                Margin:{' '}
                <span className={form.sellingPrice > form.costPrice ? 'text-brand' : 'text-danger'}>
                  {formatGhs(form.sellingPrice - form.costPrice)} per {form.saleUnit}
                  {' '}({Math.round(((form.sellingPrice - form.costPrice) / form.sellingPrice) * 100)}%)
                </span>
              </p>
            )}
          </div>

          {/* Unit conversion (collapsed by default) */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => setShowUnitFields((v) => !v)}
              className="text-sm text-muted underline"
            >
              {showUnitFields ? '▲ Hide' : '▼ Show'} unit conversion
            </button>
            {showUnitFields && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-muted">
                  Use this when you buy in bulk (e.g. a carton of 24 pieces).
                  Stock is tracked in the sale unit.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Purchase unit</label>
                    <input
                      value={form.purchaseUnit}
                      onChange={(e) => set('purchaseUnit', e.target.value)}
                      placeholder="carton"
                      className="block w-full border border-line bg-field px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Sale unit</label>
                    <input
                      value={form.saleUnit}
                      onChange={(e) => set('saleUnit', e.target.value)}
                      placeholder="piece"
                      className="block w-full border border-line bg-field px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {form.saleUnit}s per {form.purchaseUnit}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.unitsPerPurchase}
                    onChange={(e) => set('unitsPerPurchase', parseInt(e.target.value) || 1)}
                    className="block w-full border border-line bg-field px-3 py-2.5 text-sm tabular"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Initial stock */}
          <div className="space-y-3 p-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Low-stock alert threshold ({form.saleUnit}s)
              </label>
              <input
                type="number"
                min="0"
                value={form.lowStockThreshold}
                onChange={(e) => set('lowStockThreshold', parseInt(e.target.value) || 0)}
                className="block w-full border border-line bg-field px-3 py-2.5 text-sm tabular"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Opening stock ({form.saleUnit}s){' '}
                <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                type="number"
                min="0"
                value={form.initialStock || ''}
                onChange={(e) => set('initialStock', parseInt(e.target.value) || 0)}
                className="block w-full border border-line bg-field px-3 py-2.5 text-sm tabular"
              />
            </div>
            {form.initialStock > 0 && (branches.data?.length ?? 0) > 1 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Branch</label>
                <select
                  value={form.branchId}
                  onChange={(e) => set('branchId', e.target.value)}
                  className="block w-full border border-line bg-field px-3 py-2.5 text-sm"
                >
                  <option value="">— Select branch —</option>
                  {branches.data?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && (
            <div className="px-4 pb-2">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <div className="flex gap-2 p-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-line py-2.5 text-sm hover:bg-field"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createProduct.isPending}
              className="flex-1 bg-brand py-2.5 text-sm font-semibold text-paper disabled:opacity-50"
            >
              {createProduct.isPending ? 'Saving…' : 'Save product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Adjust stock modal ───────────────────────────────────────────────────────

function AdjustStockModal({
  product,
  branchId,
  currentStock,
  onClose,
}: {
  product: { id: string; name: string; saleUnit: string };
  branchId: string;
  currentStock: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const adjust = trpc.products.adjustStock.useMutation({
    onSuccess() {
      utils.products.list.invalidate();
      onClose();
    },
    onError(e) { setError(e.message); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantity = parseInt(qty);
    if (!quantity || quantity === 0) {
      setError('Enter a non-zero quantity');
      return;
    }
    adjust.mutate({ productId: product.id, branchId, quantity, note: note.trim() || undefined });
  }

  const parsed = parseInt(qty) || 0;
  const newStock = currentStock + parsed;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-paper border border-line">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">Adjust stock</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </header>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <p className="text-sm font-medium">{product.name}</p>
            <p className="text-sm text-muted">
              Current stock: <span className="tabular font-medium">{currentStock}</span> {product.saleUnit}s
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Adjustment ({product.saleUnit}s)
            </label>
            <p className="mb-1.5 text-xs text-muted">
              Positive to add stock, negative to remove.
            </p>
            <input
              type="number"
              required
              value={qty}
              onChange={(e) => { setQty(e.target.value); setError(''); }}
              className="block w-full border border-line bg-field px-3 py-2.5 text-base tabular"
              placeholder="+10 or -3"
            />
            {qty && (
              <p className={`mt-1 text-xs ${newStock < 0 ? 'text-danger' : 'text-muted'}`}>
                New stock: {newStock} {product.saleUnit}s
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Reason <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Received delivery, damaged goods"
              className="block w-full border border-line bg-field px-3 py-2.5 text-sm"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-line py-2.5 text-sm hover:bg-field"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adjust.isPending}
              className="flex-1 bg-brand py-2.5 text-sm font-semibold text-paper disabled:opacity-50"
            >
              {adjust.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Products page ────────────────────────────────────────────────────────────

export function ProductsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const defaultBranchId = user?.branchId ?? '';

  const products = trpc.products.list.useQuery({ includeInactive: false });

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [adjusting, setAdjusting] = useState<{
    id: string; name: string; saleUnit: string; stock: number
  } | null>(null);
  const [catalogMsg, setCatalogMsg] = useState('');

  const importCatalog = trpc.products.importStarterCatalog.useMutation({
    onSuccess: (data) => {
      products.refetch();
      setCatalogMsg(`Added ${data.created} products (${data.skipped} already existed).`);
      setTimeout(() => setCatalogMsg(''), 5000);
    },
  });

  const filtered = (products.data ?? []).filter((p) => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.barcode?.includes(q);
  });

  const lowStock = filtered.filter(
    (p) => p.stockQuantity !== null && p.stockQuantity <= p.lowStockThreshold,
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-line px-4 py-3 flex items-center gap-3">
        <input
          type="search"
          placeholder="Search by name or barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-line bg-field px-3 py-2 text-sm"
        />
        {canManage && (
          <>
            <button
              onClick={() => importCatalog.mutate({ branchId: defaultBranchId || undefined })}
              disabled={importCatalog.isPending}
              className="border border-line px-3 py-2 text-xs font-medium text-muted hover:bg-field disabled:opacity-50 whitespace-nowrap"
              title="Import 29 common provision store products"
            >
              {importCatalog.isPending ? 'Importing…' : 'Starter catalog'}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="bg-brand px-4 py-2 text-sm font-semibold text-paper hover:opacity-90 whitespace-nowrap"
            >
              + Add product
            </button>
          </>
        )}
      </div>

      {/* Low-stock banner */}
      {lowStock.length > 0 && !search && (
        <div className="border-b border-warn bg-field px-4 py-2 text-sm text-warn">
          {lowStock.length} product{lowStock.length > 1 ? 's' : ''} low on stock:{' '}
          {lowStock.map((p) => p.name).join(', ')}
        </div>
      )}

      {/* Product list */}
      <div className="flex-1 overflow-y-auto">
        {products.isPending && (
          <p className="p-4 text-sm text-muted">Loading…</p>
        )}
        {products.isError && (
          <p className="p-4 text-sm text-danger">Failed to load products.</p>
        )}
        {products.isSuccess && filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted">
            {search
              ? 'No products match that search.'
              : (
                <div className="space-y-4">
                  <p>No products yet.</p>
                  {canManage && (
                    <div>
                      <p className="mb-3 text-xs">Import a starter catalog of 29 common Ghana provision store products to get started quickly.</p>
                      <button
                        onClick={() => importCatalog.mutate({ branchId: defaultBranchId || undefined })}
                        disabled={importCatalog.isPending}
                        className="border-2 border-ink px-5 py-2.5 text-sm font-semibold hover:bg-field disabled:opacity-50"
                      >
                        {importCatalog.isPending ? 'Importing…' : 'Import starter catalog'}
                      </button>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}
        {catalogMsg && (
          <div className="px-4 py-2 text-sm text-brand border-b border-brand">{catalogMsg}</div>
        )}

        {filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-field text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 tabular text-right">Cost</th>
                <th className="px-4 py-2 tabular text-right">Price</th>
                <th className="px-4 py-2 tabular text-right">Stock</th>
                {canManage && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const isLow =
                  p.stockQuantity !== null && p.stockQuantity <= p.lowStockThreshold;
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-line ${i % 2 === 1 ? 'bg-field/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.name}</p>
                      {p.barcode && (
                        <p className="text-xs text-muted tabular">{p.barcode}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {p.category?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 tabular text-right text-muted">
                      {formatGhs(p.costPrice)}
                    </td>
                    <td className="px-4 py-3 tabular text-right font-medium">
                      {formatGhs(p.sellingPrice)}
                    </td>
                    <td className="px-4 py-3 tabular text-right">
                      {p.stockQuantity !== null ? (
                        <span className={isLow ? 'text-warn font-medium' : ''}>
                          {p.stockQuantity}
                          {isLow && ' ⚠'}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            setAdjusting({
                              id: p.id,
                              name: p.name,
                              saleUnit: p.saleUnit,
                              stock: p.stockQuantity ?? 0,
                            })
                          }
                          className="border border-line px-2 py-1 text-xs hover:bg-field whitespace-nowrap"
                        >
                          Adjust stock
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <ProductModal
          editId={null}
          defaultBranchId={defaultBranchId}
          onClose={() => setShowAdd(false)}
        />
      )}
      {adjusting && (
        <AdjustStockModal
          product={adjusting}
          branchId={defaultBranchId}
          currentStock={adjusting.stock}
          onClose={() => setAdjusting(null)}
        />
      )}
    </div>
  );
}
