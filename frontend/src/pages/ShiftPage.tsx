import type { inferRouterOutputs } from '@trpc/server';
import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import type { AppRouter } from '@uptilll/backend/src/routers';
import { trpc } from '../lib/trpc';

type RouterOutput = inferRouterOutputs<AppRouter>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatGhs(pesewas: number): string {
  return 'GH₵ ' + (pesewas / 100).toFixed(2);
}

function displayToPesewas(s: string): number {
  const n = parseFloat(s || '0');
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function elapsed(from: Date | string): string {
  const ms = Date.now() - new Date(from).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(dt: Date | string): string {
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dt: Date | string): string {
  return new Date(dt).toLocaleDateString([], {
    day: 'numeric', month: 'short',
  });
}

// ── Clock-in panel ────────────────────────────────────────────────────────────

function ClockInPanel({
  branchId,
  onOpened,
}: {
  branchId: string;
  onOpened: () => void;
}) {
  const [floatStr, setFloatStr] = useState('');
  const [error, setError] = useState('');

  const openMutation = trpc.shifts.open.useMutation({
    onSuccess: onOpened,
    onError: (err) => setError(err.message),
  });

  function submit() {
    const pesewas = displayToPesewas(floatStr);
    setError('');
    openMutation.mutate({ branchId, openingFloat: pesewas });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h2 className="text-base font-semibold text-ink">Clock in</h2>
        <p className="mt-1 text-sm text-muted">
          Enter the opening cash float — the amount of change money in the till
          before any sales.
        </p>

        <div className="mt-6">
          <label className="text-xs text-muted uppercase tracking-wide block mb-1.5">
            Opening float (GH₵)
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={floatStr}
            onChange={(e) => { setFloatStr(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoFocus
            className="w-full border border-line bg-field px-3 py-3 text-lg font-mono tabular-nums focus:outline-none focus:border-ink"
          />
        </div>

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        <button
          onClick={submit}
          disabled={openMutation.isPending}
          className="mt-4 w-full bg-ink py-3 text-sm font-semibold text-paper disabled:opacity-50 hover:opacity-80"
        >
          {openMutation.isPending ? 'Opening…' : 'Clock in'}
        </button>
      </div>
    </div>
  );
}

// ── Cash entry modal ──────────────────────────────────────────────────────────

function CashEntryModal({
  shiftId,
  onDone,
  onClose,
}: {
  shiftId: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<'IN' | 'OUT'>('OUT');
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const addMutation = trpc.shifts.addCashEntry.useMutation({
    onSuccess: () => { onDone(); onClose(); },
    onError: (err) => setError(err.message),
  });

  function submit() {
    const amount = displayToPesewas(amountStr);
    if (amount <= 0) { setError('Enter a positive amount'); return; }
    setError('');
    addMutation.mutate({ shiftId, type, amount, note: note || undefined });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm border border-line bg-paper">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Add cash entry</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 border border-line">
            {(['OUT', 'IN'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={[
                  'py-2.5 text-sm font-semibold',
                  type === t ? 'bg-ink text-paper' : 'bg-paper text-muted hover:bg-field hover:text-ink',
                ].join(' ')}
              >
                {t === 'IN' ? 'Cash in' : 'Cash out'}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1.5">Amount (GH₵)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amountStr}
              onChange={(e) => { setAmountStr(e.target.value); setError(''); }}
              autoFocus
              className="w-full border border-line bg-field px-3 py-2 text-lg font-mono tabular-nums focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1.5">
              Note <span className="normal-case">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Fuel money, Owner withdrawal"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-full border border-line bg-field px-3 py-2 text-sm focus:outline-none focus:border-ink"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="border border-line py-2.5 text-sm text-muted hover:bg-field hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={addMutation.isPending}
              className="bg-ink py-2.5 text-sm font-semibold text-paper disabled:opacity-50 hover:opacity-80"
            >
              {addMutation.isPending ? 'Saving…' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Close shift modal ─────────────────────────────────────────────────────────

function CloseShiftModal({
  shiftId,
  expectedCash,
  onClosed,
  onClose,
}: {
  shiftId: string;
  expectedCash: number;
  onClosed: () => void;
  onClose: () => void;
}) {
  const [countedStr, setCountedStr] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const closeMutation = trpc.shifts.close.useMutation({
    onSuccess: onClosed,
    onError: (err) => setError(err.message),
  });

  const counted = displayToPesewas(countedStr);
  const discrepancy = countedStr ? counted - expectedCash : null;

  function submit() {
    if (!countedStr) { setError('Enter the counted cash amount'); return; }
    setError('');
    closeMutation.mutate({ shiftId, countedCash: counted, note: note || undefined });
  }

  const discColor =
    discrepancy === null
      ? ''
      : discrepancy === 0
        ? 'text-brand'
        : discrepancy < 0
          ? 'text-danger'
          : 'text-warn';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm border border-line bg-paper">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Close shift</h2>
          <p className="mt-0.5 text-xs text-muted">
            Count the cash in the till and enter the total below.
          </p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex justify-between border border-line bg-field px-4 py-3">
            <span className="text-sm text-muted">Expected in till</span>
            <span className="font-mono text-sm font-bold tabular-nums">
              {formatGhs(expectedCash)}
            </span>
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1.5">
              Counted cash (GH₵)
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={countedStr}
              onChange={(e) => { setCountedStr(e.target.value); setError(''); }}
              autoFocus
              className="w-full border border-line bg-field px-3 py-2 text-lg font-mono tabular-nums focus:outline-none focus:border-ink"
            />
          </div>

          {discrepancy !== null && (
            <div className={`flex justify-between border px-4 py-3 ${discrepancy === 0 ? 'border-brand bg-paper' : 'border-line bg-paper'}`}>
              <span className="text-sm font-medium">Discrepancy</span>
              <span className={`font-mono text-sm font-bold tabular-nums ${discColor}`}>
                {discrepancy >= 0 ? '+' : ''}{formatGhs(discrepancy)}
                {discrepancy < 0 && ' (shortage)'}
                {discrepancy > 0 && ' (overage)'}
                {discrepancy === 0 && ' ✓ exact'}
              </span>
            </div>
          )}

          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1.5">
              Note <span className="normal-case">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. All good, or reason for discrepancy"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-full border border-line bg-field px-3 py-2 text-sm focus:outline-none focus:border-ink"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="border border-line py-2.5 text-sm text-muted hover:bg-field hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={closeMutation.isPending || !countedStr}
              className="bg-danger py-2.5 text-sm font-semibold text-paper disabled:opacity-30 hover:opacity-90"
            >
              {closeMutation.isPending ? 'Closing…' : 'Close shift'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Active shift dashboard ────────────────────────────────────────────────────

type ShiftData = NonNullable<RouterOutput['shifts']['current']>;

function ActiveShiftPanel({
  shift,
  onRefresh,
}: {
  shift: ShiftData;
  onRefresh: () => void;
}) {
  const [showCashEntry, setShowCashEntry] = useState(false);
  const [showClose, setShowClose] = useState(false);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-5">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block bg-brand px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-paper">
                Open
              </span>
              <span className="text-sm text-muted">
                since {formatTime(shift.openedAt)} · {elapsed(shift.openedAt)} ago
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">Cashier: {shift.cashier.name}</p>
          </div>
          <button
            onClick={() => setShowClose(true)}
            className="border border-danger px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger hover:text-paper transition-colors"
          >
            Close shift
          </button>
        </div>

        {/* Till summary */}
        <div className="mb-5 border border-line">
          <div className="border-b border-line px-4 py-2.5 bg-field">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              Till summary
            </span>
          </div>
          <div className="divide-y divide-line">
            <SummaryRow label="Opening float" value={formatGhs(shift.openingFloat)} />
            <SummaryRow label="Cash sales" value={formatGhs(shift.cashSalesTotal)} />
            {shift.cashEntries.length > 0 && (
              <SummaryRow
                label={`Cash entries (${shift.cashEntries.length})`}
                value={(shift.cashEntriesNet >= 0 ? '+' : '') + formatGhs(shift.cashEntriesNet)}
                muted={shift.cashEntriesNet === 0}
              />
            )}
          </div>
          <div className="border-t border-line bg-field px-4 py-3 flex justify-between items-baseline">
            <span className="text-sm font-semibold text-ink">Expected in till</span>
            <span className="font-mono text-xl font-bold tabular-nums text-ink">
              {formatGhs(shift.expectedNow)}
            </span>
          </div>
        </div>

        {/* Cash entries */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Cash entries
          </p>
          <button
            onClick={() => setShowCashEntry(true)}
            className="border border-line px-3 py-1 text-xs text-muted hover:bg-field hover:text-ink transition-colors"
          >
            + Add
          </button>
        </div>

        {shift.cashEntries.length === 0 ? (
          <p className="text-sm text-muted">
            No cash entries yet. Use "Add" to record cash taken out or added.
          </p>
        ) : (
          <div className="border border-line divide-y divide-line">
            {shift.cashEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span
                    className={`mr-2 text-xs font-bold uppercase ${
                      entry.type === 'IN' ? 'text-brand' : 'text-warn'
                    }`}
                  >
                    {entry.type === 'IN' ? '↓ In' : '↑ Out'}
                  </span>
                  <span className="text-sm">{entry.note ?? '—'}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatGhs(entry.amount)}
                  </span>
                  <p className="text-xs text-muted">{formatTime(entry.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCashEntry && (
        <CashEntryModal
          shiftId={shift.id}
          onDone={onRefresh}
          onClose={() => setShowCashEntry(false)}
        />
      )}

      {showClose && (
        <CloseShiftModal
          shiftId={shift.id}
          expectedCash={shift.expectedNow}
          onClosed={() => { setShowClose(false); onRefresh(); }}
          onClose={() => setShowClose(false)}
        />
      )}
    </>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline px-4 py-2.5">
      <span className="text-sm text-muted">{label}</span>
      <span className={`font-mono text-sm tabular-nums ${muted ? 'text-muted' : 'font-semibold'}`}>
        {value}
      </span>
    </div>
  );
}

// ── Past shifts list (manager / owner) ────────────────────────────────────────

type PastShift = RouterOutput['shifts']['list'][number];

function PastShiftRow({ shift }: { shift: PastShift }) {
  const disc = shift.discrepancy ?? 0;
  const discColor =
    disc === 0 ? 'text-brand' : disc < 0 ? 'text-danger' : 'text-warn';

  return (
    <div className="border-b border-line px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{shift.cashier.name}</p>
          <p className="text-xs text-muted">
            {formatDate(shift.openedAt)} · {formatTime(shift.openedAt)}
            {shift.closedAt && ` – ${formatTime(shift.closedAt)}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-mono text-sm font-bold tabular-nums ${discColor}`}>
            {disc === 0
              ? '✓ Balanced'
              : (disc > 0 ? '+' : '') + formatGhs(disc)}
          </p>
          <p className="text-xs text-muted">discrepancy</p>
        </div>
      </div>
      <div className="mt-2 flex gap-6 text-xs text-muted">
        <span>Float {formatGhs(shift.openingFloat)}</span>
        <span>Expected {formatGhs(shift.expectedCash ?? 0)}</span>
        <span>Counted {formatGhs(shift.countedCash ?? 0)}</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ShiftPage() {
  const { user } = useAuth();
  const branchId = user?.branchId ?? '';
  const isManager = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const currentQuery = trpc.shifts.current.useQuery(
    { branchId },
    { enabled: !!branchId, refetchInterval: 30_000 },
  );

  const pastQuery = trpc.shifts.list.useQuery(
    { branchId },
    { enabled: !!branchId && isManager },
  );

  function refresh() {
    currentQuery.refetch();
    if (isManager) pastQuery.refetch();
  }

  if (!branchId) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted">
          No branch assigned to your account. Ask the owner to set one.
        </p>
      </div>
    );
  }

  if (currentQuery.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted">Loading shift…</p>
      </div>
    );
  }

  const shift = currentQuery.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line px-6 py-4 bg-paper">
        <h1 className="text-sm font-semibold text-ink">Shift</h1>
        <p className="text-xs text-muted mt-0.5">Open, manage, and close your shift</p>
      </div>

      {shift ? (
        <ActiveShiftPanel shift={shift} onRefresh={refresh} />
      ) : (
        <ClockInPanel branchId={branchId} onOpened={refresh} />
      )}

      {/* Past shifts — managers only */}
      {isManager && (
        <div className="border-t border-line">
          <div className="px-6 py-3">
            <h2 className="text-xs font-bold tracking-[0.14em] uppercase text-muted">
              Past shifts
            </h2>
          </div>
          {pastQuery.isPending ? (
            <p className="px-5 pb-4 text-sm text-muted">Loading…</p>
          ) : !pastQuery.data?.length ? (
            <p className="px-5 pb-4 text-sm text-muted">No closed shifts yet.</p>
          ) : (
            <div>
              {pastQuery.data.map((s) => (
                <PastShiftRow key={s.id} shift={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
