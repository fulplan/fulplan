import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../lib/auth-context';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@ghpos/backend/src/routers';

type HistoryItem = inferRouterOutputs<AppRouter>['sales']['history']['items'][number];

const METHODS = ['CASH', 'MOMO', 'CREDIT', 'SPLIT'] as const;

function ghs(p: number) {
  return `GH₵ ${(p / 100).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(val: string | Date) {
  const d = new Date(val);
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

// ─── Void modal ───────────────────────────────────────────────────────────────

function VoidModal({
  saleId,
  onClose,
  onDone,
}: {
  saleId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const verifyPin = trpc.staff.verifyManagerPin.useMutation();
  const voidSale  = trpc.sales.void.useMutation({ onSuccess: onDone });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!reason.trim()) { setError('Reason is required'); return; }
    if (user?.role === 'CASHIER') { setError('Only managers can void sales'); return; }
    if (user?.role === 'MANAGER') {
      try { await verifyPin.mutateAsync({ pin }); }
      catch { setError('Invalid manager PIN'); return; }
    }
    voidSale.mutate({ saleId, reason: reason.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-paper border border-line w-full max-w-sm mx-4">
        <div className="border-b border-line px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-danger">Void Sale</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-lg leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-muted uppercase mb-1">Reason</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Return, pricing error…"
              className="w-full border border-line bg-field px-3 py-2 text-sm text-ink"
              maxLength={200}
            />
          </div>
          {user?.role === 'MANAGER' && (
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-muted uppercase mb-1">Manager PIN</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                inputMode="numeric"
                maxLength={8}
                className="w-full border border-line bg-field px-3 py-2 text-sm text-ink tracking-widest"
              />
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-line py-2 text-sm text-muted hover:bg-field"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={voidSale.isPending || verifyPin.isPending}
              className="flex-1 bg-danger text-paper py-2 text-sm font-medium disabled:opacity-50"
            >
              {voidSale.isPending ? 'Voiding…' : 'Void sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

const METHOD_STYLE: Record<string, string> = {
  CASH:   'bg-brand/10 text-brand',
  MOMO:   'bg-warn/10 text-warn',
  CREDIT: 'bg-danger/10 text-danger',
  SPLIT:  'bg-field text-muted',
};

function SaleRow({ sale, canVoid }: { sale: HistoryItem; canVoid: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [voiding, setVoiding]   = useState(false);
  const utils = trpc.useUtils();
  const isVoided = sale.status === 'VOIDED';

  return (
    <>
      <tr
        className={`border-b border-line hover:bg-field transition-colors cursor-pointer ${isVoided ? 'opacity-50' : ''}`}
        onClick={() => setExpanded(x => !x)}
      >
        <td className="px-3 py-2.5 text-xs text-muted tabular-nums whitespace-nowrap">
          {fmtDate(sale.createdAt)}
        </td>
        <td className="px-3 py-2.5 text-sm text-ink">{sale.cashier.name}</td>
        <td className="px-3 py-2.5 text-sm text-muted">{sale.customer?.name ?? '—'}</td>
        <td className="px-3 py-2.5">
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 ${METHOD_STYLE[sale.paymentMethod] ?? ''}`}>
            {sale.paymentMethod}
          </span>
        </td>
        <td className="px-3 py-2.5 text-xs text-muted text-center">{sale.items.length}</td>
        <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-right text-ink">
          {ghs(sale.total)}
        </td>
        <td className="px-3 py-2.5 text-right">
          <div className="flex items-center justify-end gap-3">
            {isVoided && (
              <span className="text-[10px] font-bold text-danger uppercase tracking-wider">Voided</span>
            )}
            {!isVoided && canVoid && (
              <button
                onClick={e => { e.stopPropagation(); setVoiding(true); }}
                className="text-xs text-muted hover:text-danger transition-colors"
              >
                Void
              </button>
            )}
            <a
              href={`/receipt/${sale.id}`}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs text-brand hover:underline"
            >
              Receipt ↗
            </a>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-sidebar border-b border-line">
          <td colSpan={7} className="px-6 py-3">
            <div className="space-y-1 max-w-lg">
              {sale.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted">{item.name} × {item.quantity}</span>
                  <span className="tabular-nums text-ink">{ghs(item.lineTotal)}</span>
                </div>
              ))}
              {sale.discountTotal > 0 && (
                <div className="flex justify-between text-xs pt-1 border-t border-line">
                  <span className="text-danger">Discount</span>
                  <span className="tabular-nums text-danger">−{ghs(sale.discountTotal)}</span>
                </div>
              )}
              {sale.note && <p className="text-xs text-muted pt-1 italic">{sale.note}</p>}
              {isVoided && sale.voidReason && (
                <p className="text-xs text-danger pt-1">Void reason: {sale.voidReason}</p>
              )}
            </div>
          </td>
        </tr>
      )}

      {voiding && (
        <VoidModal
          saleId={sale.id}
          onClose={() => setVoiding(false)}
          onDone={() => {
            setVoiding(false);
            utils.sales.history.invalidate();
          }}
        />
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SalesHistoryPage() {
  const { user }             = useAuth();
  const { data: branches }   = trpc.branches.list.useQuery();
  const { data: staff }      = trpc.staff.list.useQuery();

  const today      = new Date();
  const todayStr   = today.toISOString().slice(0, 10);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  // Draft filter state (bound to inputs)
  const [draftBranch,  setDraftBranch]  = useState('');
  const [draftCashier, setDraftCashier] = useState('');
  const [draftMethod,  setDraftMethod]  = useState('');
  const [draftStatus,  setDraftStatus]  = useState('');
  const [draftFrom,    setDraftFrom]    = useState(monthStart);
  const [draftTo,      setDraftTo]      = useState(todayStr);

  // Applied (committed) filter state — query key is derived from these
  const [applied, setApplied] = useState({
    branchId:      undefined as string | undefined,
    cashierId:     undefined as string | undefined,
    paymentMethod: undefined as 'CASH' | 'MOMO' | 'CREDIT' | 'SPLIT' | undefined,
    status:        undefined as 'COMPLETED' | 'VOIDED' | undefined,
    from:          monthStart,
    to:            todayStr,
  });

  function applyFilters() {
    setApplied({
      branchId:      draftBranch  || undefined,
      cashierId:     draftCashier || undefined,
      paymentMethod: (draftMethod  || undefined) as typeof applied.paymentMethod,
      status:        (draftStatus  || undefined) as typeof applied.status,
      from:          draftFrom,
      to:            draftTo,
    });
  }

  const { data, fetchNextPage, hasNextPage, isLoading, isFetchingNextPage } =
    trpc.sales.history.useInfiniteQuery(
      {
        branchId:      applied.branchId,
        cashierId:     applied.cashierId,
        paymentMethod: applied.paymentMethod,
        status:        applied.status,
        from:  applied.from ? new Date(applied.from).toISOString() : undefined,
        to:    applied.to   ? new Date(applied.to + 'T23:59:59').toISOString() : undefined,
        limit: 50,
      },
      { getNextPageParam: (last) => last.nextCursor, initialCursor: undefined },
    );

  const allItems = data?.pages.flatMap(p => p.items) ?? [];
  const totalRevenue = allItems.filter(s => s.status === 'COMPLETED').reduce((sum, s) => sum + s.total, 0);
  const canVoid    = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const multiBranch = (branches?.length ?? 0) > 1;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="border-b border-line px-6 py-4 bg-paper">
        <h1 className="text-sm font-semibold text-ink">Sales History</h1>
        <p className="text-xs text-muted mt-0.5">Browse, audit, and void all transactions</p>
      </div>

      {/* Filter bar */}
      <div className="border-b border-line bg-sidebar px-6 py-3 flex flex-wrap items-end gap-3">
        <FilterField label="From">
          <input
            type="date"
            value={draftFrom}
            onChange={e => setDraftFrom(e.target.value)}
            className="border border-line bg-paper px-2 py-1.5 text-sm text-ink"
          />
        </FilterField>
        <FilterField label="To">
          <input
            type="date"
            value={draftTo}
            onChange={e => setDraftTo(e.target.value)}
            className="border border-line bg-paper px-2 py-1.5 text-sm text-ink"
          />
        </FilterField>
        {multiBranch && (
          <FilterField label="Branch">
            <select
              value={draftBranch}
              onChange={e => setDraftBranch(e.target.value)}
              className="border border-line bg-paper px-2 py-1.5 text-sm text-ink"
            >
              <option value="">All</option>
              {branches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </FilterField>
        )}
        <FilterField label="Cashier">
          <select
            value={draftCashier}
            onChange={e => setDraftCashier(e.target.value)}
            className="border border-line bg-paper px-2 py-1.5 text-sm text-ink"
          >
            <option value="">All staff</option>
            {staff?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Method">
          <select
            value={draftMethod}
            onChange={e => setDraftMethod(e.target.value)}
            className="border border-line bg-paper px-2 py-1.5 text-sm text-ink"
          >
            <option value="">All</option>
            {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </FilterField>
        <FilterField label="Status">
          <select
            value={draftStatus}
            onChange={e => setDraftStatus(e.target.value)}
            className="border border-line bg-paper px-2 py-1.5 text-sm text-ink"
          >
            <option value="">All</option>
            <option value="COMPLETED">Completed</option>
            <option value="VOIDED">Voided</option>
          </select>
        </FilterField>
        <button
          onClick={applyFilters}
          className="bg-ink text-paper px-4 py-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
        >
          Apply
        </button>
      </div>

      {/* Summary strip */}
      {allItems.length > 0 && (
        <div className="bg-paper border-b border-line px-6 py-2 flex items-center gap-6 text-xs">
          <span className="text-muted">{allItems.length} sales loaded</span>
          <span className="text-ink font-semibold tabular-nums">{ghs(totalRevenue)} revenue</span>
          {hasNextPage && <span className="text-muted">— more available below</span>}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted">Loading…</p>
          </div>
        ) : allItems.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted">No sales match the selected filters.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-sidebar border-b border-line sticky top-0">
              <tr>
                {['Date / Time', 'Cashier', 'Customer', 'Method', 'Items', 'Total', ''].map(h => (
                  <th
                    key={h}
                    className="px-3 py-2 text-[10px] font-bold tracking-[0.12em] text-muted uppercase whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allItems.map(sale => (
                <SaleRow key={sale.id} sale={sale} canVoid={canVoid} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Load more */}
      {hasNextPage && (
        <div className="border-t border-line px-6 py-4 flex items-center gap-3 bg-paper">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="border border-line px-4 py-2 text-sm text-ink hover:bg-field disabled:opacity-50 transition-colors"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load 50 more'}
          </button>
          <span className="text-xs text-muted">{allItems.length} transactions shown</span>
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold tracking-[0.12em] text-muted uppercase mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
