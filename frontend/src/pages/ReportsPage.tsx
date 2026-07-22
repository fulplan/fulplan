import { useState } from "react";
import { trpc } from "../lib/trpc";
import { formatMoney } from "../lib/money";

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function isoRange(from: Date, to: Date) {
  return { from: from.toISOString(), to: to.toISOString() };
}

type QuickPeriod = "today" | "yesterday" | "week" | "month";

function quickRange(period: QuickPeriod): { from: Date; to: Date } {
  const now = new Date();
  switch (period) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "week": {
      const w = new Date(now);
      w.setDate(w.getDate() - 6);
      return { from: startOfDay(w), to: endOfDay(now) };
    }
    case "month": {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(m), to: endOfDay(now) };
    }
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const [quick, setQuick] = useState<QuickPeriod>("today");
  const [tab, setTab] = useState<"summary" | "shifts" | "products">("summary");

  const { from, to } = quickRange(quick);
  const range = isoRange(from, to);

  const QUICK_LABELS: { id: QuickPeriod; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "week", label: "Last 7 days" },
    { id: "month", label: "This month" },
  ];

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Reports</h1>

      {/* Period picker */}
      <div className="flex gap-1 mb-5 border border-line">
        {QUICK_LABELS.map((q) => (
          <button
            key={q.id}
            onClick={() => setQuick(q.id)}
            className={[
              "flex-1 py-2 text-xs font-medium",
              quick === q.id ? "bg-ink text-paper" : "hover:bg-field",
            ].join(" ")}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-5 border-b border-line">
        {(["summary", "products", "shifts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-4 py-2 text-sm font-medium capitalize -mb-px",
              tab === t ? "border-b-2 border-ink" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            {t === "summary" ? "P&L Summary" : t === "products" ? "Top Products" : "Shift Log"}
          </button>
        ))}
      </div>

      {tab === "summary" && <SummaryTab range={range} />}
      {tab === "products" && <ProductsTab range={range} />}
      {tab === "shifts" && <ShiftsTab />}
    </div>
  );
}

// ── Daily revenue bar chart ───────────────────────────────────────────────────

type DayPoint = { date: string; revenue: number; count: number };

function DailyTrendChart({ days }: { days: DayPoint[] }) {
  if (days.length === 0) return null;

  const maxRev = Math.max(...days.map((d) => d.revenue), 1);
  const W = 560;
  const H = 120;
  const PAD_LEFT = 0;
  const PAD_BOTTOM = 20;
  const BAR_AREA_H = H - PAD_BOTTOM;
  const n = days.length;
  const barW = Math.max(4, Math.floor((W - PAD_LEFT) / n) - 2);
  const gap = Math.floor((W - PAD_LEFT - barW * n) / Math.max(n - 1, 1));

  const shortDate = (iso: string) => {
    const parts = iso.split("-");
    return `${parseInt(parts[1] ?? "1")}/${parseInt(parts[2] ?? "1")}`;
  };

  // Show label every N bars so they don't overlap
  const labelEvery = n <= 7 ? 1 : n <= 14 ? 2 : 5;

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        aria-label="Daily revenue chart"
        style={{ maxHeight: 120 }}
      >
        {days.map((d, i) => {
          const barH = Math.max(2, (d.revenue / maxRev) * BAR_AREA_H);
          const x = PAD_LEFT + i * (barW + gap);
          const y = BAR_AREA_H - barH;
          const showLabel = i % labelEvery === 0 || i === n - 1;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill={d.revenue > 0 ? "var(--color-brand, #1a6b35)" : "var(--color-line, #e5e5e5)"}
              />
              {showLabel && (
                <text
                  x={x + barW / 2}
                  y={H - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--color-muted, #888)"
                >
                  {shortDate(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Payment breakdown bar ─────────────────────────────────────────────────────

function PaymentBar({ byMethod, revenue }: { byMethod: { CASH: number; MOMO: number; CREDIT: number }; revenue: number }) {
  if (revenue === 0) return null;
  const cashPct = (byMethod.CASH / revenue) * 100;
  const momoPct = (byMethod.MOMO / revenue) * 100;
  const creditPct = (byMethod.CREDIT / revenue) * 100;

  return (
    <div className="mt-3">
      <div className="flex h-6 w-full overflow-hidden">
        {cashPct > 0 && (
          <div className="bg-brand flex items-center justify-center" style={{ width: `${cashPct}%` }}>
            {cashPct > 8 && <span className="text-paper text-xs font-medium truncate px-1">Cash</span>}
          </div>
        )}
        {momoPct > 0 && (
          <div className="bg-ink flex items-center justify-center" style={{ width: `${momoPct}%` }}>
            {momoPct > 8 && <span className="text-paper text-xs font-medium truncate px-1">MoMo</span>}
          </div>
        )}
        {creditPct > 0 && (
          <div className="bg-warn flex items-center justify-center" style={{ width: `${creditPct}%` }}>
            {creditPct > 8 && <span className="text-paper text-xs font-medium truncate px-1">Credit</span>}
          </div>
        )}
      </div>
      <div className="flex gap-4 mt-1.5">
        {cashPct > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-brand inline-block" />
            <span className="text-xs text-muted">{cashPct.toFixed(0)}% Cash</span>
          </div>
        )}
        {momoPct > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-ink inline-block" />
            <span className="text-xs text-muted">{momoPct.toFixed(0)}% MoMo</span>
          </div>
        )}
        {creditPct > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-warn inline-block" />
            <span className="text-xs text-muted">{creditPct.toFixed(0)}% Credit</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── P&L Summary tab ───────────────────────────────────────────────────────────

function SummaryTab({ range }: { range: { from: string; to: string } }) {
  const { data, isLoading } = trpc.reports.summary.useQuery(range);
  const spanDays = Math.round(
    (new Date(range.to).getTime() - new Date(range.from).getTime()) / (1000 * 60 * 60 * 24),
  );
  const { data: trend } = trpc.reports.dailyTrend.useQuery(range, {
    enabled: spanDays > 1,
  });

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>;
  if (!data) return null;

  const margin = data.revenue > 0 ? ((data.grossProfit / data.revenue) * 100).toFixed(1) : "0.0";
  const netMargin = data.revenue > 0 ? ((data.netProfit / data.revenue) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-4">
      {/* Revenue + payment breakdown */}
      <Section title="Sales">
        <MetricRow label="Transactions" value={String(data.salesCount)} />
        <MetricRow label="Revenue" value={formatMoney(data.revenue)} bold />
        <div className="border-t border-line mt-2 pt-2 space-y-1">
          <MetricRow label="  Cash" value={formatMoney(data.byMethod.CASH)} small />
          <MetricRow label="  MoMo" value={formatMoney(data.byMethod.MOMO)} small />
          <MetricRow label="  Credit" value={formatMoney(data.byMethod.CREDIT)} small />
        </div>
        <PaymentBar byMethod={data.byMethod} revenue={data.revenue} />
        {trend && trend.length > 1 && <DailyTrendChart days={trend} />}
      </Section>

      {/* Gross profit */}
      <Section title="Gross profit">
        <MetricRow label="Revenue" value={formatMoney(data.revenue)} />
        <MetricRow label="Cost of goods" value={`− ${formatMoney(data.cogs)}`} />
        <div className="border-t border-line mt-2 pt-2">
          <MetricRow
            label="Gross profit"
            value={`${formatMoney(data.grossProfit)} (${margin}%)`}
            bold
            negative={data.grossProfit < 0}
          />
        </div>
      </Section>

      {/* Net profit */}
      <Section title="Net profit">
        <MetricRow label="Gross profit" value={formatMoney(data.grossProfit)} />
        <MetricRow label="Expenses" value={`− ${formatMoney(data.expenses)}`} />
        <MetricRow label="Salary paid" value={`− ${formatMoney(data.salaryPaid)}`} />
        <div className="border-t border-line mt-2 pt-2">
          <MetricRow
            label="Net profit"
            value={`${formatMoney(data.netProfit)} (${netMargin}%)`}
            bold
            negative={data.netProfit < 0}
          />
        </div>
      </Section>
    </div>
  );
}

// ── Top products tab ──────────────────────────────────────────────────────────

function ProductsTab({ range }: { range: { from: string; to: string } }) {
  const { data, isLoading } = trpc.reports.topProducts.useQuery(range);

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>;
  if (!data || data.length === 0)
    return <div className="border border-line p-6 text-center text-sm text-muted">No sales in this period.</div>;

  const maxRevenue = Math.max(...data.map((p) => p.revenue), 1);

  return (
    <div className="border border-line divide-y divide-line">
      {data.map((p, i) => {
        const margin = p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0;
        return (
          <div key={p.productId} className="px-4 py-3">
            <div className="flex items-baseline justify-between mb-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-xs text-muted w-5 tabular-nums">{i + 1}.</span>
                <span className="text-sm font-medium truncate">{p.name}</span>
              </div>
              <div className="text-right ml-4 shrink-0">
                <span className="text-sm font-semibold tabular-nums">{formatMoney(p.revenue)}</span>
                <span className="text-xs text-muted ml-2">{p.qty} sold</span>
              </div>
            </div>
            {/* Mini progress bar */}
            <div className="h-1 bg-line mt-1">
              <div
                className="h-1 bg-brand"
                style={{ width: `${(p.revenue / maxRevenue) * 100}%` }}
              />
            </div>
            <div className="text-xs text-muted mt-0.5">
              Margin: {margin.toFixed(1)}% · COGS {formatMoney(p.cogs)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Shift log tab ─────────────────────────────────────────────────────────────

function ShiftsTab() {
  const { data, isLoading } = trpc.reports.shiftLog.useQuery({});

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>;
  if (!data || data.length === 0)
    return <div className="border border-line p-6 text-center text-sm text-muted">No closed shifts yet.</div>;

  return (
    <div className="border border-line divide-y divide-line">
      {data.map((shift) => {
        const disc = shift.discrepancy ?? 0;
        return (
          <div key={shift.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-sm font-medium">{shift.cashier.name}</span>
                {shift.branch && (
                  <span className="text-xs text-muted ml-2">· {shift.branch.name}</span>
                )}
              </div>
              <span className="text-xs text-muted">
                {new Date(shift.openedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex gap-4 text-xs mt-1">
              <span className="text-muted">
                Expected: <span className="tabular-nums font-mono text-ink">{formatMoney(shift.expectedCash ?? 0)}</span>
              </span>
              <span className="text-muted">
                Counted: <span className="tabular-nums font-mono text-ink">{formatMoney(shift.countedCash ?? 0)}</span>
              </span>
              <span className={disc < 0 ? "text-danger font-semibold" : disc > 0 ? "text-brand font-semibold" : "text-muted"}>
                {disc === 0 ? "No discrepancy" : `${disc > 0 ? "+" : ""}${formatMoney(disc)}`}
              </span>
            </div>
            {shift.note && <div className="text-xs text-muted mt-0.5">{shift.note}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-line">
      <div className="px-4 py-2 bg-field border-b border-line">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-1.5">{children}</div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  bold,
  small,
  negative,
}: {
  label: string;
  value: string;
  bold?: boolean;
  small?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={small ? "text-xs text-muted" : "text-sm text-muted"}>{label}</span>
      <span
        className={[
          "tabular-nums font-mono",
          small ? "text-xs" : "text-sm",
          bold ? "font-bold text-ink" : "",
          negative ? "text-danger" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
