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
  const [tab, setTab] = useState<"summary" | "shifts" | "products" | "zreport" | "staff">("summary");

  const { from, to } = quickRange(quick);
  const range = isoRange(from, to);

  const QUICK_LABELS: { id: QuickPeriod; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "week", label: "Last 7 days" },
    { id: "month", label: "This month" },
  ];

  const TABS = [
    { id: "summary", label: "P&L" },
    { id: "products", label: "Products" },
    { id: "shifts", label: "Shifts" },
    { id: "staff", label: "Staff" },
    { id: "zreport", label: "Z-Report" },
  ] as const;

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Page header ── */}
      <div className="border-b border-line px-6 py-4 bg-paper print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-ink">Reports</h1>
            <p className="text-xs text-muted mt-0.5">P&L, products, shifts, and Z-reports</p>
          </div>
          {/* Period picker */}
          <div className="flex border border-line shrink-0">
            {QUICK_LABELS.map((q) => (
              <button
                key={q.id}
                onClick={() => setQuick(q.id)}
                className={[
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  quick === q.id
                    ? "bg-ink text-paper"
                    : "text-muted hover:bg-field hover:text-ink",
                ].join(" ")}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-0 mt-4 border-b border-line -mb-px overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                "px-4 py-2 text-sm font-medium shrink-0 border-b-2 transition-colors",
                tab === t.id
                  ? "border-ink text-ink"
                  : "border-transparent text-muted hover:text-ink",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 px-6 py-5">
        {tab === "summary" && <SummaryTab range={range} />}
        {tab === "products" && <ProductsTab range={range} />}
        {tab === "shifts" && <ShiftsTab />}
        {tab === "staff" && <StaffPerformanceTab range={range} />}
        {tab === "zreport" && <ZReportTab range={range} quick={quick} />}
      </div>
    </div>
  );
}

// ── Daily revenue bar chart ───────────────────────────────────────────────────

type DayPoint = { date: string; revenue: number; count: number };

function DailyTrendChart({ days }: { days: DayPoint[] }) {
  if (days.length === 0) return null;

  const maxRev = Math.max(...days.map((d) => d.revenue), 1);
  const W = 560;
  const H = 100;
  const PAD_BOTTOM = 18;
  const BAR_AREA_H = H - PAD_BOTTOM;
  const n = days.length;
  const barW = Math.max(4, Math.floor(W / n) - 3);
  const gap = Math.floor((W - barW * n) / Math.max(n - 1, 1));
  const labelEvery = n <= 7 ? 1 : n <= 14 ? 2 : 5;

  const shortDate = (iso: string) => {
    const parts = iso.split("-");
    return `${parseInt(parts[1] ?? "1")}/${parseInt(parts[2] ?? "1")}`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 100 }} aria-label="Daily revenue trend">
      {days.map((d, i) => {
        const barH = Math.max(2, (d.revenue / maxRev) * BAR_AREA_H);
        const x = i * (barW + gap);
        const y = BAR_AREA_H - barH;
        const showLabel = i % labelEvery === 0 || i === n - 1;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={barH}
              fill={d.revenue > 0 ? "var(--color-brand, #1a6b35)" : "var(--color-line, #e5e5e5)"}
              opacity={0.85}
            />
            {showLabel && (
              <text x={x + barW / 2} y={H - 3} textAnchor="middle" fontSize={8} fill="var(--color-muted, #888)">
                {shortDate(d.date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Payment segment bar ───────────────────────────────────────────────────────

function PaymentSegmentBar({ byMethod, revenue }: { byMethod: { CASH: number; MOMO: number; CREDIT: number }; revenue: number }) {
  if (revenue === 0) return null;
  const cashPct = (byMethod.CASH / revenue) * 100;
  const momoPct = (byMethod.MOMO / revenue) * 100;
  const creditPct = (byMethod.CREDIT / revenue) * 100;

  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded-sm">
        {cashPct > 0 && (
          <div className="bg-brand flex items-center justify-center" style={{ width: `${cashPct}%` }}>
            {cashPct > 10 && <span className="text-paper text-[10px] font-semibold px-1">Cash</span>}
          </div>
        )}
        {momoPct > 0 && (
          <div className="bg-ink flex items-center justify-center" style={{ width: `${momoPct}%` }}>
            {momoPct > 10 && <span className="text-paper text-[10px] font-semibold px-1">MoMo</span>}
          </div>
        )}
        {creditPct > 0 && (
          <div className="bg-warn flex items-center justify-center" style={{ width: `${creditPct}%` }}>
            {creditPct > 10 && <span className="text-paper text-[10px] font-semibold px-1">Credit</span>}
          </div>
        )}
      </div>
      <div className="flex gap-4 mt-2">
        {cashPct > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="w-2 h-2 rounded-[2px] bg-brand inline-block" />
            {cashPct.toFixed(0)}% Cash · {formatMoney(byMethod.CASH)}
          </span>
        )}
        {momoPct > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="w-2 h-2 rounded-[2px] bg-ink inline-block" />
            {momoPct.toFixed(0)}% MoMo · {formatMoney(byMethod.MOMO)}
          </span>
        )}
        {creditPct > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="w-2 h-2 rounded-[2px] bg-warn inline-block" />
            {creditPct.toFixed(0)}% Credit · {formatMoney(byMethod.CREDIT)}
          </span>
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
  const { data: trend } = trpc.reports.dailyTrend.useQuery(range, { enabled: spanDays > 1 });

  if (isLoading) return <div className="text-sm text-muted py-8 text-center">Loading…</div>;
  if (!data) return null;

  const margin = data.revenue > 0 ? ((data.grossProfit / data.revenue) * 100).toFixed(1) : "0.0";
  const netMargin = data.revenue > 0 ? ((data.netProfit / data.revenue) * 100).toFixed(1) : "0.0";
  const netPositive = data.netProfit >= 0;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Hero KPI row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Revenue — dark hero */}
        <div className="bg-ink text-paper px-5 py-4 relative overflow-hidden">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-paper/40 mb-1">Revenue</p>
          <p className="text-3xl font-bold tabular-nums leading-none">{formatMoney(data.revenue)}</p>
          <p className="text-xs text-paper/40 mt-2">{data.salesCount} transactions</p>
          <div className="absolute -right-3 -bottom-3 w-20 h-20 rounded-full bg-paper/5" />
        </div>

        {/* Gross profit */}
        <div className={[
          "px-5 py-4 border-l-4",
          data.grossProfit >= 0 ? "border-l-brand bg-brand/5" : "border-l-danger bg-danger/5",
        ].join(" ")}>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted mb-1">Gross profit</p>
          <p className={[
            "text-3xl font-bold tabular-nums leading-none",
            data.grossProfit >= 0 ? "text-brand" : "text-danger",
          ].join(" ")}>{formatMoney(data.grossProfit)}</p>
          <p className="text-xs text-muted mt-2">{margin}% margin</p>
        </div>

        {/* Net profit */}
        <div className={[
          "px-5 py-4 border-l-4",
          netPositive ? "border-l-brand bg-brand/5" : "border-l-danger bg-danger/5",
        ].join(" ")}>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted mb-1">Net profit</p>
          <p className={[
            "text-3xl font-bold tabular-nums leading-none",
            netPositive ? "text-brand" : "text-danger",
          ].join(" ")}>{formatMoney(data.netProfit)}</p>
          <p className="text-xs text-muted mt-2">{netMargin}% net margin</p>
        </div>
      </div>

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Payment breakdown */}
        <div className="border border-line">
          <div className="px-4 py-2.5 border-b border-line bg-field">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Payment breakdown</span>
          </div>
          <div className="px-4 py-4 space-y-3">
            <PaymentSegmentBar byMethod={data.byMethod} revenue={data.revenue} />
            {trend && trend.length > 1 && (
              <div className="mt-4 pt-4 border-t border-line">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-2">Daily trend</p>
                <DailyTrendChart days={trend} />
              </div>
            )}
          </div>
        </div>

        {/* Right: P&L waterfall */}
        <div className="border border-line">
          <div className="px-4 py-2.5 border-b border-line bg-field">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Profit & Loss</span>
          </div>
          <div className="px-4 py-4 space-y-0">
            <PLRow label="Revenue" value={formatMoney(data.revenue)} />
            <PLRow label="Cost of goods sold" value={`− ${formatMoney(data.cogs)}`} indent />
            <div className="border-t border-line my-2" />
            <PLRow label="Gross profit" value={`${formatMoney(data.grossProfit)} (${margin}%)`} bold accent={data.grossProfit >= 0 ? "brand" : "danger"} />
            <div className="pt-2">
              <PLRow label="Expenses" value={`− ${formatMoney(data.expenses)}`} indent />
              <PLRow label="Salary paid" value={`− ${formatMoney(data.salaryPaid)}`} indent />
            </div>
            <div className="border-t border-line my-2" />
            <PLRow label="Net profit" value={`${formatMoney(data.netProfit)} (${netMargin}%)`} bold accent={netPositive ? "brand" : "danger"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PLRow({
  label,
  value,
  bold,
  indent,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  indent?: boolean;
  accent?: "brand" | "danger";
}) {
  return (
    <div className={["flex items-baseline justify-between py-1.5", indent ? "pl-3" : ""].join(" ")}>
      <span className={["text-sm", bold ? "font-semibold text-ink" : "text-muted"].join(" ")}>{label}</span>
      <span className={[
        "tabular-nums font-mono text-sm",
        bold ? "font-bold" : "",
        accent === "brand" ? "text-brand" : accent === "danger" ? "text-danger" : "text-ink",
      ].filter(Boolean).join(" ")}>{value}</span>
    </div>
  );
}

// ── Top products tab ──────────────────────────────────────────────────────────

const RANK_COLORS = [
  "bg-amber-400 text-amber-900",  // 1st
  "bg-slate-300 text-slate-700",  // 2nd
  "bg-amber-700/60 text-amber-100", // 3rd
];

function ProductsTab({ range }: { range: { from: string; to: string } }) {
  const { data, isLoading } = trpc.reports.topProducts.useQuery(range);

  if (isLoading) return <div className="text-sm text-muted py-8 text-center">Loading…</div>;
  if (!data || data.length === 0)
    return <div className="border border-line px-6 py-12 text-center text-sm text-muted">No sales in this period.</div>;

  const maxRevenue = Math.max(...data.map((p) => p.revenue), 1);

  return (
    <div className="max-w-3xl">
      <div className="border border-line divide-y divide-line">
        {data.map((p, i) => {
          const margin = p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0;
          const rankColor = RANK_COLORS[i] ?? "bg-field text-muted";
          return (
            <div key={p.productId} className="flex items-center gap-4 px-4 py-3">
              <span className={["w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", rankColor].join(" ")}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <div className="ml-4 shrink-0 text-right">
                    <span className="text-sm font-bold tabular-nums text-ink">{formatMoney(p.revenue)}</span>
                    <span className="text-xs text-muted ml-2">{p.qty} sold</span>
                  </div>
                </div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden">
                  <div
                    className="h-1.5 bg-brand rounded-full transition-all"
                    style={{ width: `${(p.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted mt-1">
                  Margin <span className={margin >= 0 ? "text-brand font-semibold" : "text-danger font-semibold"}>{margin.toFixed(1)}%</span>
                  <span className="ml-3">COGS {formatMoney(p.cogs)}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shift log tab ─────────────────────────────────────────────────────────────

function ShiftsTab() {
  const { data, isLoading } = trpc.reports.shiftLog.useQuery({});

  if (isLoading) return <div className="text-sm text-muted py-8 text-center">Loading…</div>;
  if (!data || data.length === 0)
    return <div className="border border-line px-6 py-12 text-center text-sm text-muted">No closed shifts yet.</div>;

  return (
    <div className="max-w-3xl border border-line divide-y divide-line">
      {data.map((shift) => {
        const disc = shift.discrepancy ?? 0;
        const discColor = disc < 0 ? "text-danger font-semibold" : disc > 0 ? "text-brand font-semibold" : "text-muted";
        return (
          <div key={shift.id} className="px-4 py-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{shift.cashier.name}</span>
                {shift.branch && <span className="text-xs text-muted">· {shift.branch.name}</span>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted mt-1">
                <span>Expected <span className="tabular-nums font-mono text-ink">{formatMoney(shift.expectedCash ?? 0)}</span></span>
                <span>Counted <span className="tabular-nums font-mono text-ink">{formatMoney(shift.countedCash ?? 0)}</span></span>
              </div>
              {shift.note && <p className="text-xs text-muted mt-0.5 truncate">{shift.note}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className={["text-sm tabular-nums font-mono", discColor].join(" ")}>
                {disc === 0 ? "Balanced" : `${disc > 0 ? "+" : ""}${formatMoney(disc)}`}
              </p>
              <p className="text-xs text-muted mt-0.5">{new Date(shift.openedAt).toLocaleDateString()}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Staff performance tab ─────────────────────────────────────────────────────

function StaffPerformanceTab({ range }: { range: { from: string; to: string } }) {
  const { data, isLoading } = trpc.reports.staffPerformance.useQuery(range);

  if (isLoading) return <div className="text-sm text-muted py-8 text-center">Loading…</div>;
  if (!data || data.length === 0)
    return <div className="border border-line px-6 py-12 text-center text-sm text-muted">No sales in this period.</div>;

  const maxRevenue = Math.max(...data.map((s) => s.revenue), 1);

  return (
    <div className="max-w-3xl border border-line divide-y divide-line">
      {data.map((s, i) => {
        const avg = s.count > 0 ? Math.round(s.revenue / s.count) : 0;
        const rankColor = RANK_COLORS[i] ?? "bg-field text-muted";
        return (
          <div key={s.cashierId} className="flex items-center gap-4 px-4 py-3">
            <span className={["w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", rankColor].join(" ")}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-medium truncate">{s.name}</span>
                <div className="ml-4 shrink-0 text-right">
                  <span className="text-sm font-bold tabular-nums text-ink">{formatMoney(s.revenue)}</span>
                  <span className="text-xs text-muted ml-2">{s.count} sales</span>
                </div>
              </div>
              <div className="h-1.5 bg-line rounded-full overflow-hidden">
                <div className="h-1.5 bg-brand rounded-full" style={{ width: `${(s.revenue / maxRevenue) * 100}%` }} />
              </div>
              <p className="text-xs text-muted mt-1">Avg sale <span className="text-ink font-semibold">{formatMoney(avg)}</span></p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Z-Report tab ─────────────────────────────────────────────────────────────

function ZReportTab({ range, quick }: { range: { from: string; to: string }; quick: QuickPeriod }) {
  const { data: summary, isLoading: sumLoading } = trpc.reports.summary.useQuery(range);
  const { data: topProds, isLoading: topLoading } = trpc.reports.topProducts.useQuery({ ...range, limit: 5 });
  const { data: shifts, isLoading: shiftsLoading } = trpc.reports.shiftLog.useQuery({});

  const isLoading = sumLoading || topLoading || shiftsLoading;
  if (isLoading) return <div className="text-sm text-muted py-8 text-center">Loading…</div>;
  if (!summary) return null;

  const now = new Date();
  const periodLabel =
    quick === "today"
      ? now.toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : quick === "yesterday" ? "Yesterday"
      : quick === "week" ? "Last 7 days"
      : "This month";

  const margin = summary.revenue > 0 ? ((summary.grossProfit / summary.revenue) * 100).toFixed(1) : "0.0";
  const netPositive = summary.netProfit >= 0;

  const periodShifts = (shifts ?? []).filter((s) => {
    if (!s.closedAt) return false;
    const closed = new Date(s.closedAt);
    return closed >= new Date(range.from) && closed <= new Date(range.to);
  });

  const cashPct = summary.revenue > 0 ? (summary.byMethod.CASH / summary.revenue) * 100 : 0;
  const momoPct = summary.revenue > 0 ? (summary.byMethod.MOMO / summary.revenue) * 100 : 0;
  const creditPct = summary.revenue > 0 ? (summary.byMethod.CREDIT / summary.revenue) * 100 : 0;

  return (
    <div>
      {/* Print control */}
      <div className="flex justify-end mb-4 print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-ink text-paper px-4 py-2 text-sm font-semibold hover:opacity-80"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
          </svg>
          Print Z-Report
        </button>
      </div>

      {/* ── Z-Report document ── */}
      <div className="border border-line bg-paper max-w-2xl mx-auto print:max-w-none print:border-0 print:shadow-none">

        {/* Dark header */}
        <div className="bg-ink text-paper px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-paper/40 mb-1">End-of-day report</p>
              <p className="text-2xl font-bold tracking-tight">Z-Report</p>
              <p className="text-sm text-paper/60 mt-1">{periodLabel}</p>
            </div>
            <div className="text-right text-xs text-paper/40">
              <p>Generated</p>
              <p className="text-paper/60">{now.toLocaleString("en-GH")}</p>
            </div>
          </div>
        </div>

        {/* ── KPI tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-line border-b border-line">
          <ZKpi label="Revenue" value={formatMoney(summary.revenue)} accent="ink" />
          <ZKpi label="Transactions" value={String(summary.salesCount)} />
          <ZKpi label="Gross profit" value={formatMoney(summary.grossProfit)} accent={summary.grossProfit >= 0 ? "brand" : "danger"} />
          <ZKpi label="Net profit" value={formatMoney(summary.netProfit)} accent={netPositive ? "brand" : "danger"} sub={`${margin}% margin`} />
        </div>

        {/* ── Body sections ── */}
        <div className="divide-y divide-line">

          {/* Payment breakdown */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-3">Payment methods</p>
            {summary.revenue > 0 ? (
              <>
                <div className="flex h-6 w-full overflow-hidden rounded-sm mb-2">
                  {cashPct > 0 && (
                    <div className="bg-brand flex items-center justify-center" style={{ width: `${cashPct}%` }}>
                      {cashPct > 12 && <span className="text-paper text-[10px] font-bold px-1">Cash</span>}
                    </div>
                  )}
                  {momoPct > 0 && (
                    <div className="bg-ink flex items-center justify-center" style={{ width: `${momoPct}%` }}>
                      {momoPct > 12 && <span className="text-paper text-[10px] font-bold px-1">MoMo</span>}
                    </div>
                  )}
                  {creditPct > 0 && (
                    <div className="bg-warn flex items-center justify-center" style={{ width: `${creditPct}%` }}>
                      {creditPct > 12 && <span className="text-paper text-[10px] font-bold px-1">Credit</span>}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <ZPayMethod label="Cash" value={formatMoney(summary.byMethod.CASH)} pct={cashPct} color="bg-brand" />
                  <ZPayMethod label="MoMo" value={formatMoney(summary.byMethod.MOMO)} pct={momoPct} color="bg-ink" />
                  <ZPayMethod label="Credit" value={formatMoney(summary.byMethod.CREDIT)} pct={creditPct} color="bg-warn" />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">No payments recorded.</p>
            )}
          </div>

          {/* P&L breakdown */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-3">Profit & Loss</p>
            <div className="space-y-0">
              <ZLine label="Revenue" value={formatMoney(summary.revenue)} />
              <ZLine label="Cost of goods" value={`− ${formatMoney(summary.cogs)}`} indent />
              <div className="border-t border-dashed border-line my-2" />
              <ZLine label="Gross profit" value={`${formatMoney(summary.grossProfit)} (${margin}%)`} bold accent={summary.grossProfit >= 0 ? "brand" : "danger"} />
              <div className="pt-1">
                <ZLine label="Expenses" value={`− ${formatMoney(summary.expenses)}`} indent />
                <ZLine label="Salary paid" value={`− ${formatMoney(summary.salaryPaid)}`} indent />
              </div>
              <div className="border-t border-dashed border-line my-2" />
              <ZLine label="Net profit" value={formatMoney(summary.netProfit)} bold accent={netPositive ? "brand" : "danger"} />
            </div>
          </div>

          {/* Top products */}
          {topProds && topProds.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-3">Top products</p>
              <div className="space-y-2">
                {topProds.map((p, i) => {
                  const rankColors = ["text-amber-500", "text-slate-400", "text-amber-700"];
                  const rc = rankColors[i] ?? "text-muted";
                  return (
                    <div key={p.productId} className="flex items-center gap-3">
                      <span className={["text-xs font-bold w-4 tabular-nums", rc].join(" ")}>{i + 1}</span>
                      <span className="text-sm flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-muted shrink-0">{p.qty}×</span>
                      <span className="text-sm font-semibold tabular-nums font-mono shrink-0">{formatMoney(p.revenue)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Shifts */}
          {periodShifts.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-3">Shifts ({periodShifts.length})</p>
              <div className="space-y-2">
                {periodShifts.map((s) => {
                  const disc = s.discrepancy ?? 0;
                  return (
                    <div key={s.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{s.cashier.name}</p>
                        <p className="text-xs text-muted">
                          Expected {formatMoney(s.expectedCash ?? 0)} · Counted {formatMoney(s.countedCash ?? 0)}
                        </p>
                      </div>
                      <span className={[
                        "text-sm tabular-nums font-mono font-semibold",
                        disc < 0 ? "text-danger" : disc > 0 ? "text-brand" : "text-muted",
                      ].join(" ")}>
                        {disc === 0 ? "✓ Balanced" : `${disc > 0 ? "+" : ""}${formatMoney(disc)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-field border-t border-line px-5 py-3 flex items-center justify-between">
          <p className="text-xs text-muted">GhPOS · End of report</p>
          <p className="text-xs text-muted tabular-nums">{now.toLocaleDateString("en-GH")}</p>
        </div>
      </div>
    </div>
  );
}

// ── Z-Report sub-components ───────────────────────────────────────────────────

function ZKpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "ink" | "brand" | "danger" }) {
  const valColor =
    accent === "brand" ? "text-brand"
    : accent === "danger" ? "text-danger"
    : "text-ink";

  return (
    <div className="px-4 py-3 bg-paper">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-1">{label}</p>
      <p className={["text-lg font-bold tabular-nums leading-tight", valColor].join(" ")}>{value}</p>
      {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function ZPayMethod({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="border border-line px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={["w-2 h-2 rounded-[2px] shrink-0", color].join(" ")} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="text-sm font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted">{pct.toFixed(0)}%</p>
    </div>
  );
}

function ZLine({
  label,
  value,
  bold,
  indent,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  indent?: boolean;
  accent?: "brand" | "danger";
}) {
  return (
    <div className={["flex justify-between gap-4 py-1", indent ? "pl-4" : ""].join(" ")}>
      <span className={["text-sm", bold ? "font-semibold text-ink" : "text-muted"].join(" ")}>{label}</span>
      <span className={[
        "tabular-nums font-mono text-sm",
        bold ? "font-bold" : "",
        accent === "brand" ? "text-brand" : accent === "danger" ? "text-danger" : "text-ink",
      ].filter(Boolean).join(" ")}>{value}</span>
    </div>
  );
}
