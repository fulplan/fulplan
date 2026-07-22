import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@ghpos/backend/src/routers';
import { trpc } from '../lib/trpc';

type RouterOutput = inferRouterOutputs<AppRouter>;
type SaleData = RouterOutput['sales']['receipt'];

function fmt(pesewas: number) {
  return 'GH₵ ' + (pesewas / 100).toFixed(2);
}

function Line({ label, value, bold, danger }: { label: string; value: string; bold?: boolean; danger?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 text-sm ${bold ? 'font-bold' : ''} ${danger ? 'text-danger' : ''}`}>
      <span className={bold || danger ? '' : 'text-muted'}>{label}</span>
      <span className="tabular-nums font-mono">{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-line my-3" />;
}

// ── Invoice layout (credit / wholesale sales) ─────────────────────────────────

function InvoiceView({ sale }: { sale: SaleData }) {
  const date = new Date(sale.createdAt);
  const dateStr = date.toLocaleDateString('en-GH', { day: '2-digit', month: 'long', year: 'numeric' });
  const invoiceNo = sale.id.slice(-8).toUpperCase();

  const handlePrint = () => window.print();

  return (
    <div className="min-h-dvh bg-field py-8 px-4 print:bg-white print:p-0">
      <div
        className="mx-auto bg-paper border border-line print:border-0 print:shadow-none"
        style={{ maxWidth: 600 }}
      >
        {/* Invoice header */}
        <div className="px-8 pt-8 pb-6 border-b-2 border-ink">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xl font-bold uppercase tracking-widest">
                {sale.branch.receiptHeader || sale.organization.name}
              </p>
              {sale.branch.receiptHeader && (
                <p className="text-sm text-muted mt-0.5">{sale.branch.name}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tracking-tight">INVOICE</p>
              <p className="text-xs text-muted mt-1">No. {invoiceNo}</p>
            </div>
          </div>
        </div>

        {/* Bill-to + date */}
        <div className="px-8 py-5 flex justify-between gap-8 border-b border-line">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted mb-1">Bill To</p>
            <p className="text-sm font-semibold">{sale.customer?.name ?? 'Walk-in Customer'}</p>
            {sale.customer?.phone && (
              <p className="text-xs text-muted">{sale.customer.phone}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold uppercase text-muted mb-1">Date</p>
            <p className="text-sm">{dateStr}</p>
            <p className="text-xs text-muted mt-1">Cashier: {sale.cashier.name}</p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-field border-b border-line">
              <th className="px-8 py-2 text-left text-xs font-semibold uppercase text-muted">Item</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted">Unit</th>
              <th className="px-8 py-2 text-right text-xs font-semibold uppercase text-muted">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, i) => (
              <tr key={i} className="border-b border-line">
                <td className="px-8 py-2.5 font-medium">{item.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{item.quantity}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-mono">{fmt(item.unitPrice)}</td>
                <td className="px-8 py-2.5 text-right tabular-nums font-mono">{fmt(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="px-8 py-5 space-y-1.5 border-t-2 border-ink max-w-xs ml-auto">
          {sale.discountTotal > 0 && (
            <>
              <Line label="Subtotal" value={fmt(sale.subtotal)} />
              <Line label="Discount" value={`− ${fmt(sale.discountTotal)}`} />
            </>
          )}
          <div className="flex justify-between text-base font-bold border-t border-line pt-2 mt-2">
            <span>TOTAL DUE</span>
            <span className="tabular-nums font-mono">{fmt(sale.total)}</span>
          </div>
          {sale.status === 'VOIDED' && (
            <p className="text-danger text-xs font-bold mt-1">VOIDED</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 pt-2 border-t border-line text-xs text-muted">
          <p className="font-semibold text-ink mb-0.5">Payment Terms</p>
          <p>This invoice is payable on presentation. Overdue accounts may incur interest.</p>
          {sale.note && <p className="mt-1 italic">Note: {sale.note}</p>}
          <p className="mt-3 opacity-50">Ref: {sale.id}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="print:hidden mt-5 mx-auto space-y-3" style={{ maxWidth: 600 }}>
        <button
          onClick={handlePrint}
          className="flex w-full items-center justify-center border-2 border-ink bg-paper py-3 text-sm font-semibold hover:bg-field"
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}

// ── Receipt layout (cash / MoMo / split sales) ────────────────────────────────

function ReceiptView({ sale }: { sale: SaleData }) {
  const date = new Date(sale.createdAt);
  const dateStr = date.toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });

  const receiptUrl = window.location.href;
  const shopName = sale.organization.name;
  const waText = encodeURIComponent(`Your receipt from ${shopName}: ${receiptUrl}`);
  const waUrl = `https://wa.me/?text=${waText}`;

  const payLabel = () => {
    if (sale.paymentMethod === 'SPLIT') {
      return `Cash ${fmt(sale.cashAmount)} + MoMo ${fmt(sale.momoAmount)}`;
    }
    if (sale.paymentMethod === 'CASH') return `Cash ${fmt(sale.amountTendered)}`;
    if (sale.paymentMethod === 'MOMO') return `MoMo ${fmt(sale.amountTendered)}`;
    return sale.paymentMethod;
  };

  return (
    <div className="min-h-dvh bg-field py-8 px-4 print:bg-white print:p-0 print:py-0">
      <div
        className="receipt-print mx-auto bg-paper border border-line print:border-0 print:shadow-none"
        style={{ maxWidth: 320, width: '100%' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 text-center border-b-2 border-ink">
          <p className="text-base font-bold uppercase tracking-widest">
            {sale.branch.receiptHeader || sale.organization.name}
          </p>
          {sale.branch.receiptHeader && (
            <p className="text-xs text-muted mt-0.5">{sale.branch.name}</p>
          )}
          <p className="text-xs text-muted mt-2">{dateStr} · {timeStr}</p>
          <p className="text-xs text-muted">Cashier: {sale.cashier.name}</p>
          {sale.status === 'VOIDED' && (
            <p className="text-danger text-xs font-bold mt-1 uppercase tracking-wide">VOIDED</p>
          )}
        </div>

        {/* Items */}
        <div className="px-5 py-3 space-y-1.5">
          {sale.items.map((item, i) => (
            <div key={i} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <span className="tabular-nums font-mono shrink-0">{fmt(item.lineTotal)}</span>
              </div>
              <span className="text-xs text-muted">
                {item.quantity} × {fmt(item.unitPrice)}
              </span>
            </div>
          ))}
        </div>

        <Divider />

        {/* Totals */}
        <div className="px-5 pb-3 space-y-1.5">
          {sale.discountTotal > 0 && (
            <Line label="Subtotal" value={fmt(sale.subtotal)} />
          )}
          {sale.discountTotal > 0 && (
            <Line label="Discount" value={`− ${fmt(sale.discountTotal)}`} />
          )}
          <Line label="TOTAL" value={fmt(sale.total)} bold />
          <Line label="Paid" value={payLabel()} />
          {sale.paymentMethod === 'CASH' && sale.change > 0 && (
            <Line label="Change" value={fmt(sale.change)} />
          )}
        </div>

        <Divider />

        {/* Footer */}
        <div className="px-5 pb-5 text-center text-xs text-muted">
          <p>Thank you for your purchase!</p>
          <p className="mt-1 break-all opacity-50 text-[10px]">Ref: {sale.id}</p>
        </div>
      </div>

      {/* Action buttons — hidden on print */}
      <div className="print:hidden mt-5 mx-auto space-y-3" style={{ maxWidth: 320 }}>
        <button
          onClick={() => window.print()}
          className="flex w-full items-center justify-center border-2 border-ink bg-paper py-3 text-sm font-semibold hover:bg-field"
        >
          Print receipt
        </button>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center bg-brand py-3 text-sm font-semibold text-paper hover:opacity-90"
        >
          Share via WhatsApp
        </a>
      </div>
    </div>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function ReceiptPage({ saleId }: { saleId: string }) {
  const { data: sale, isLoading, isError } = trpc.sales.receipt.useQuery({ saleId });

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (isError || !sale) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="text-center">
          <p className="text-base font-semibold">Receipt not found</p>
          <p className="mt-1 text-sm text-muted">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  if (sale.paymentMethod === 'CREDIT') {
    return <InvoiceView sale={sale} />;
  }

  return <ReceiptView sale={sale} />;
}
