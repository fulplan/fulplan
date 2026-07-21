import { trpc } from '../lib/trpc';

function fmt(pesewas: number) {
  return 'GH₵ ' + (pesewas / 100).toFixed(2);
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 text-sm ${bold ? 'font-bold' : ''}`}>
      <span className={bold ? '' : 'text-muted'}>{label}</span>
      <span className="tabular-nums font-mono">{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-line my-3" />;
}

export function ReceiptPage({ saleId }: { saleId: string }) {
  const { data: sale, isLoading, isError } = trpc.sales.receipt.useQuery({ saleId });

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Loading receipt…</p>
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

  const date = new Date(sale.createdAt);
  const dateStr = date.toLocaleDateString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-GH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const receiptUrl = window.location.href;
  const shopName = sale.organization.name;
  const waText = encodeURIComponent(`Your receipt from ${shopName}: ${receiptUrl}`);
  const waUrl = `https://wa.me/?text=${waText}`;

  return (
    <div className="min-h-dvh bg-field py-8 px-4 print:bg-white print:p-0 print:py-0">
      {/* receipt card */}
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
            <Line label="Discount" value={`−${fmt(sale.discountTotal)}`} />
          )}
          <Line label="TOTAL" value={fmt(sale.total)} bold />
          <Line
            label="Paid"
            value={`${sale.paymentMethod === 'CASH' ? 'Cash' : 'MoMo'} ${fmt(sale.amountTendered)}`}
          />
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
