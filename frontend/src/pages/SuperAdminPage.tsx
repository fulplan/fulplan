import { useEffect, useRef, useState } from "react";
import { trpc } from "../lib/trpc";

// ─── Time helper ─────────────────────────────────────────────────────────────

function formatTxTime(iso: string): { time: string; date: string | null; rel: string } {
  const dt = new Date(iso);
  const now = new Date();
  const isToday =
    dt.getDate() === now.getDate() &&
    dt.getMonth() === now.getMonth() &&
    dt.getFullYear() === now.getFullYear();
  const time = dt.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const date = isToday ? null : dt.toLocaleDateString("en-GH", { day: "numeric", month: "short" });
  const mins = Math.floor((now.getTime() - dt.getTime()) / 60_000);
  const rel = mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
  return { time, date, rel };
}

function fmtMoney(p: number): string {
  return `GH₵ ${(p / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Platform today stats ─────────────────────────────────────────────────────

function PlatformTodayStats() {
  const { data, isLoading } = trpc.superAdmin.todayStats.useQuery(
    undefined,
    { refetchInterval: 30_000 },
  );

  if (isLoading) return <div className="border border-line p-5 text-sm text-muted">Loading…</div>;
  if (!data) return null;

  return (
    <div className="border border-line">
      <div className="px-4 py-2.5 border-b border-line bg-field">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Today across platform</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-line">
        <div className="px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-1">Revenue</p>
          <p className="text-2xl font-bold tabular-nums text-ink">{fmtMoney(data.revenue)}</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-1">Sales</p>
          <p className="text-2xl font-bold tabular-nums text-ink">{data.salesCount.toLocaleString()}</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-1">Active orgs</p>
          <p className="text-2xl font-bold tabular-nums text-brand">{data.activeOrgs}</p>
          <p className="text-xs text-muted mt-0.5">sold today</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-1">New signups</p>
          <p className="text-2xl font-bold tabular-nums text-ink">{data.newOrgs}</p>
          <p className="text-xs text-muted mt-0.5">today</p>
        </div>
      </div>
    </div>
  );
}

// ─── Platform activity feed ───────────────────────────────────────────────────

const PM_STYLE: Record<string, [string, string]> = {
  CASH:   ["bg-brand/10 text-brand",   "Cash"],
  MOMO:   ["bg-warn/10 text-warn",     "MoMo"],
  CREDIT: ["bg-danger/10 text-danger", "Credit"],
  SPLIT:  ["bg-field text-ink",        "Split"],
};

function PlatformActivityFeed() {
  const { data: sales, isFetching, dataUpdatedAt } = trpc.superAdmin.recentActivity.useQuery(
    undefined,
    { refetchInterval: 10_000 },
  );

  const topIdRef = useRef<string | undefined>(undefined);
  const [flashId, setFlashId] = useState<string | undefined>(undefined);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt));
    const top = sales?.[0]?.id;
    if (!top) return;
    if (topIdRef.current !== undefined && top !== topIdRef.current) {
      setFlashId(top);
      const t = setTimeout(() => setFlashId(undefined), 2000);
      topIdRef.current = top;
      return () => clearTimeout(t);
    }
    topIdRef.current = top;
  }, [sales, dataUpdatedAt]);

  const updatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    : null;

  return (
    <div className="border border-line flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-field">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Live activity</span>
        <span className="text-[10px] font-mono tabular-nums text-muted">
          {isFetching ? (
            <span className="text-brand font-bold animate-pulse">Updating…</span>
          ) : updatedStr ? (
            <>Updated <span className="text-ink font-semibold">{updatedStr}</span></>
          ) : null}
        </span>
      </div>
      {!sales || sales.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-10 text-xs text-muted">No recent activity</div>
      ) : (
        <div className="divide-y divide-line overflow-y-auto" style={{ maxHeight: 340 }}>
          {sales.map((s) => {
            const [cls, label] = PM_STYLE[s.paymentMethod] ?? ["bg-field text-muted", s.paymentMethod];
            const { time, date, rel } = formatTxTime(s.createdAt);
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors duration-700 ${s.id === flashId ? "bg-brand/10" : ""}`}
              >
                <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-[2px] ${cls}`}>
                  {label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{s.orgName}</p>
                  <p className="text-xs text-muted truncate">{s.branchName}</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-bold tabular-nums">{fmtMoney(s.total)}</p>
                  <p className="text-xs font-mono tabular-nums text-ink mt-0.5">{time}</p>
                  <p className="text-[10px] text-muted">{date ?? rel}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Admin clock ─────────────────────────────────────────────────────────────

function AdminClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden sm:block text-right shrink-0">
      <p className="text-base font-mono font-bold tabular-nums text-ink leading-none">
        {now.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
      </p>
      <p className="text-[10px] text-muted mt-0.5">
        {now.toLocaleDateString("en-GH", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
      </p>
    </div>
  );
}

// ─── Live badge ───────────────────────────────────────────────────────────────

function LiveBadge({ active, interval }: { active: boolean; interval: number }) {
  return (
    <span className="flex items-center gap-1.5 select-none">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand">
        {active ? "Updating…" : `Live · ${interval}s`}
      </span>
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  TRIALING:  { bg: "bg-brand/10",   text: "text-brand",   label: "Trial" },
  ACTIVE:    { bg: "bg-brand/20",   text: "text-brand",   label: "Active" },
  PAST_DUE:  { bg: "bg-warn/15",    text: "text-warn",    label: "Past due" },
  LOCKED:    { bg: "bg-danger/10",  text: "text-danger",  label: "Locked" },
  CANCELLED: { bg: "bg-field",      text: "text-muted",   label: "Cancelled" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE["CANCELLED"]!;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`border border-line p-4 ${accent ? "bg-ink text-paper" : "bg-paper"}`}>
      <div className={`text-[10px] font-bold tracking-[0.16em] uppercase mb-1 ${accent ? "text-paper/50" : "text-muted"}`}>
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${accent ? "text-paper" : "text-ink"}`}>{value}</div>
      {sub && <div className={`text-xs mt-0.5 ${accent ? "text-paper/40" : "text-muted"}`}>{sub}</div>}
    </div>
  );
}

// ─── Extend trial modal ───────────────────────────────────────────────────────

function ExtendTrialModal({
  orgId,
  orgName,
  onClose,
}: {
  orgId: string;
  orgName: string;
  onClose: () => void;
}) {
  const [days, setDays] = useState("14");
  const utils = trpc.useUtils();
  const extend = trpc.superAdmin.extendTrial.useMutation({
    onSuccess: () => { utils.superAdmin.listOrgs.invalidate(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-paper border border-line w-full max-w-sm mx-4">
        <div className="border-b border-line px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Extend trial</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-lg leading-none">×</button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted">
            Extend trial for <span className="font-semibold text-ink">{orgName}</span>
          </p>
          <div>
            <label className="block text-xs text-muted mb-1">Additional days</label>
            <input
              type="number"
              min="1"
              max="365"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full border border-line px-3 py-2 text-sm font-mono"
            />
          </div>
          {extend.error && <p className="text-xs text-danger">{extend.error.message}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-line py-2 text-sm text-muted hover:bg-field"
            >
              Cancel
            </button>
            <button
              onClick={() => extend.mutate({ orgId, days: parseInt(days) || 14 })}
              disabled={extend.isPending}
              className="flex-1 bg-brand text-paper py-2 text-sm font-semibold disabled:opacity-50"
            >
              {extend.isPending ? "Saving…" : "Extend"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status change modal ──────────────────────────────────────────────────────

type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "LOCKED" | "CANCELLED";

function ChangeStatusModal({
  orgId,
  orgName,
  current,
  onClose,
}: {
  orgId: string;
  orgName: string;
  current: SubscriptionStatus;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<SubscriptionStatus>(current);
  const utils = trpc.useUtils();
  const update = trpc.superAdmin.updateSubscription.useMutation({
    onSuccess: () => { utils.superAdmin.listOrgs.invalidate(); onClose(); },
  });

  const STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "LOCKED", "CANCELLED"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-paper border border-line w-full max-w-sm mx-4">
        <div className="border-b border-line px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Change status</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-lg leading-none">×</button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted">
            Update subscription for <span className="font-semibold text-ink">{orgName}</span>
          </p>
          <div className="space-y-2">
            {STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-field">
                <input
                  type="radio"
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="accent-brand"
                />
                <StatusBadge status={s} />
              </label>
            ))}
          </div>
          {update.error && <p className="text-xs text-danger">{update.error.message}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-line py-2 text-sm text-muted hover:bg-field"
            >
              Cancel
            </button>
            <button
              onClick={() => update.mutate({ orgId, status })}
              disabled={update.isPending || status === current}
              className="flex-1 bg-ink text-paper py-2 text-sm font-semibold disabled:opacity-40"
            >
              {update.isPending ? "Saving…" : "Update"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Org table row ────────────────────────────────────────────────────────────

type OrgRow = {
  id: string;
  name: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  createdAt: string;
  ownerEmail: string | null;
  ownerName: string | null;
  userCount: number;
  saleCount: number;
  productCount: number;
};

function OrgTableRow({ org }: { org: OrgRow }) {
  const [modal, setModal] = useState<"extend" | "status" | null>(null);

  const trialDaysLeft = org.trialEndsAt
    ? Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <>
      <tr className="border-b border-line hover:bg-field transition-colors">
        <td className="px-4 py-3">
          <div className="font-medium text-sm text-ink">{org.name}</div>
          <div className="text-xs text-muted">{org.ownerEmail ?? "—"}</div>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={org.subscriptionStatus} />
          {trialDaysLeft !== null && (
            <div className={`text-[10px] mt-0.5 ${trialDaysLeft < 3 ? "text-danger" : "text-muted"}`}>
              {trialDaysLeft > 0 ? `${trialDaysLeft}d left` : "Expired"}
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-sm tabular-nums text-muted">{org.userCount}</td>
        <td className="px-4 py-3 text-sm tabular-nums text-muted">{org.saleCount.toLocaleString()}</td>
        <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
          {new Date(org.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModal("extend")}
              className="text-xs text-brand hover:underline"
            >
              Extend
            </button>
            <button
              onClick={() => setModal("status")}
              className="text-xs text-muted hover:text-ink"
            >
              Status
            </button>
          </div>
        </td>
      </tr>

      {modal === "extend" && (
        <ExtendTrialModal orgId={org.id} orgName={org.name} onClose={() => setModal(null)} />
      )}
      {modal === "status" && (
        <ChangeStatusModal
          orgId={org.id}
          orgName={org.name}
          current={org.subscriptionStatus as SubscriptionStatus}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SuperAdminPage({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: stats, isLoading: statsLoading, isFetching: statsFetching } = trpc.superAdmin.getStats.useQuery(
    undefined,
    { refetchInterval: 60_000 },
  );
  const { data: orgs, isLoading: orgsLoading, isFetching: orgsFetching } = trpc.superAdmin.listOrgs.useQuery(
    undefined,
    { refetchInterval: 60_000 },
  );
  const isFetching = statsFetching || orgsFetching;

  const filtered = (orgs ?? []).filter((o) => {
    const matchSearch =
      !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.ownerEmail ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || o.subscriptionStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="border-b border-line px-6 py-4 bg-paper flex items-center gap-3">
        <button onClick={onBack} className="text-muted hover:text-ink text-sm leading-none">←</button>
        <div className="flex-1 flex items-center gap-3">
          <div>
            <h1 className="text-sm font-semibold text-ink">Platform Admin</h1>
            <p className="text-xs text-muted mt-0.5">Manage all GhPOS organisations and subscriptions</p>
          </div>
          <LiveBadge active={isFetching} interval={60} />
        </div>
        <AdminClock />
      </div>

      <div className="px-6 py-6 max-w-6xl mx-auto w-full">

        {/* Stats */}
        {statsLoading ? (
          <div className="text-sm text-muted mb-6">Loading stats…</div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            <StatCard label="Total orgs" value={stats.total} accent />
            <StatCard label="Trialing" value={stats.trialing} sub="Free trial" />
            <StatCard label="Active" value={stats.active} sub="Paying" />
            <StatCard label="Past due" value={stats.pastDue} sub="Needs payment" />
            <StatCard label="Locked" value={stats.locked} sub="Blocked" />
            <StatCard label="Total sales" value={stats.totalSales.toLocaleString()} sub="All time" />
          </div>
        ) : null}

        {/* Today + live activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          <PlatformTodayStats />
          <PlatformActivityFeed />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-line bg-field px-3 py-2 text-sm w-full max-w-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-line bg-field px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="TRIALING">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="PAST_DUE">Past due</option>
            <option value="LOCKED">Locked</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          {(search || statusFilter) && (
            <button
              onClick={() => { setSearch(""); setStatusFilter(""); }}
              className="text-sm text-muted hover:text-ink"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-muted self-center ml-auto">
            {filtered.length} organisations
          </span>
        </div>

        {/* Table */}
        {orgsLoading ? (
          <div className="text-sm text-muted py-8 text-center">Loading organisations…</div>
        ) : (
          <div className="border border-line overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-field border-b border-line">
                <tr>
                  {["Organisation", "Status", "Users", "Sales", "Created", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-[10px] font-bold tracking-[0.14em] uppercase text-muted whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                      No organisations match.
                    </td>
                  </tr>
                ) : (
                  filtered.map((org) => <OrgTableRow key={org.id} org={org} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
