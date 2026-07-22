import { useMemo, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { trpc } from '../lib/trpc';
import { CheckoutPage } from './CheckoutPage';
import { CustomersPage } from './CustomersPage';
import { ProductsPage } from './ProductsPage';
import { ShiftPage } from './ShiftPage';
import { SuppliersPage } from './SuppliersPage';
import { StockTakePage } from './StockTakePage';
import { SalaryExpensesPage } from './SalaryExpensesPage';
import { ReportsPage } from './ReportsPage';
import { SalesHistoryPage } from './SalesHistoryPage';
import { SettingsPage } from './SettingsPage';
import { StaffPage } from './StaffPage';

type Page =
  | 'home'
  | 'checkout'
  | 'shift'
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'stocktake'
  | 'expenses'
  | 'reports'
  | 'history'
  | 'settings'
  | 'staff';

type NavItem = { id: Page; label: string; roles?: string[] };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ id: 'home', label: 'Dashboard', roles: ['OWNER', 'MANAGER'] }],
  },
  {
    label: 'Sell',
    items: [
      { id: 'checkout', label: 'Checkout' },
      { id: 'shift', label: 'Shift' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { id: 'products', label: 'Products', roles: ['OWNER', 'MANAGER'] },
      { id: 'stocktake', label: 'Stock take', roles: ['OWNER', 'MANAGER'] },
      { id: 'suppliers', label: 'Suppliers', roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'customers', label: 'Customers', roles: ['OWNER', 'MANAGER'] },
      { id: 'expenses', label: 'Expenses', roles: ['OWNER', 'MANAGER'] },
      { id: 'reports', label: 'Reports', roles: ['OWNER', 'MANAGER'] },
      { id: 'history', label: 'Sales history', roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    label: 'People',
    items: [{ id: 'staff', label: 'Staff', roles: ['OWNER', 'MANAGER'] }],
  },
  {
    label: 'Admin',
    items: [{ id: 'settings', label: 'Settings', roles: ['OWNER', 'MANAGER'] }],
  },
];

function defaultPage(role: string): Page {
  return role === 'CASHIER' ? 'checkout' : 'home';
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

type SidebarProps = {
  page: Page;
  onNavigate: (p: Page) => void;
  visibleGroups: NavGroup[];
  userName: string;
  userRole: string;
  orgName: string;
  onSignOut: () => void;
};

function Sidebar({ page, onNavigate, visibleGroups, userName, userRole, orgName, onSignOut }: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand / org */}
      <div className="px-4 pt-5 pb-4 border-b border-line">
        <p className="text-[10px] font-bold tracking-[0.18em] text-muted uppercase">GhPOS</p>
        <p className="text-sm font-semibold text-ink mt-1 truncate leading-tight">{orgName}</p>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-4 pb-1 text-[10px] font-bold tracking-[0.14em] text-muted uppercase">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={[
                    'w-full text-left text-sm py-[7px] border-l-2 transition-colors',
                    active
                      ? 'bg-field text-ink font-semibold border-brand pl-[14px] pr-4'
                      : 'text-muted hover:bg-field hover:text-ink border-transparent pl-[14px] pr-4',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User dock */}
      <div className="border-t border-line px-4 py-3">
        <p className="text-sm font-medium text-ink truncate">{userName}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[11px] text-muted capitalize">{userRole.toLowerCase()}</span>
          <button
            onClick={onSignOut}
            className="text-[11px] text-muted hover:text-danger transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App shell ────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [page, setPage] = useState<Page>(() => defaultPage(user?.role ?? 'CASHIER'));
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.roles || item.roles.includes(user.role)),
  })).filter((g) => g.items.length > 0);

  function navigate(p: Page) {
    setPage(p);
    setMobileOpen(false);
  }

  const navLabel = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === page)?.label ?? '';

  const sidebarProps: SidebarProps = {
    page,
    onNavigate: navigate,
    visibleGroups,
    userName: user.name,
    userRole: user.role,
    orgName: user.organizationName,
    onSignOut: signOut,
  };

  return (
    <div className="flex min-h-dvh bg-paper">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-56 shrink-0 bg-sidebar border-r border-line sticky top-0 h-dvh">
        <Sidebar {...sidebarProps} />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-sidebar border-b border-line h-12 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-xl leading-none text-ink"
          aria-label="Open menu"
        >
          ≡
        </button>
        <span className="text-sm font-semibold text-ink">{navLabel}</span>
        <span className="ml-auto text-xs text-muted truncate max-w-[140px]">{user.organizationName}</span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/25" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 bg-sidebar border-r border-line h-full">
            <Sidebar {...sidebarProps} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden h-12 shrink-0" />
        {page === 'home'      && <DashboardHome />}
        {page === 'checkout'  && <CheckoutPage />}
        {page === 'shift'     && <ShiftPage />}
        {page === 'products'  && <ProductsPage />}
        {page === 'customers' && <CustomersPage />}
        {page === 'suppliers' && <SuppliersPage />}
        {page === 'stocktake' && <StockTakePage />}
        {page === 'expenses'  && <SalaryExpensesPage />}
        {page === 'reports'   && <ReportsPage />}
        {page === 'history'   && <SalesHistoryPage />}
        {page === 'settings'  && <SettingsPage />}
        {page === 'staff'     && <StaffPage />}
      </main>
    </div>
  );
}

// ─── Dashboard home ───────────────────────────────────────────────────────────

function ghs(p: number) {
  return `GH₵ ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DashboardHome() {
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const { data: branches } = trpc.branches.list.useQuery();
  const { data, isLoading } = trpc.reports.dashboard.useQuery({ branchId });

  const trendDates = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const { data: trendData } = trpc.reports.dailyTrend.useQuery({ ...trendDates, branchId });

  const multiBranch = (branches?.length ?? 0) > 1;
  const today = data?.today;
  const totalPay = (today?.byMethod.CASH ?? 0) + (today?.byMethod.MOMO ?? 0) + (today?.byMethod.CREDIT ?? 0);

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="flex flex-col min-h-full">
      {/* Page header */}
      <div className="border-b border-line px-6 py-4 flex items-center justify-between gap-4 bg-paper">
        <div>
          <h1 className="text-sm font-semibold text-ink tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted mt-0.5">{todayLabel}</p>
        </div>
        {multiBranch && (
          <div className="flex items-center gap-1 flex-wrap">
            <BranchBtn active={branchId === undefined} onClick={() => setBranchId(undefined)}>All</BranchBtn>
            {branches?.map((b) => (
              <BranchBtn key={b.id} active={branchId === b.id} onClick={() => setBranchId(b.id)}>
                {b.name}
              </BranchBtn>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted">Loading…</p>
        </div>
      ) : !data || !today ? null : (
        <div className="p-6 space-y-5 w-full max-w-5xl">

          {/* KPI row — revenue */}
          <div>
            <SectionLabel>Today</SectionLabel>
            <div className="grid grid-cols-3 gap-px border border-line bg-line mt-2">
              <KpiCard label="Revenue" value={ghs(today.revenue)} size="lg" />
              <KpiCard label="Transactions" value={String(today.salesCount)} size="lg" />
              <KpiCard
                label="Avg sale"
                value={today.salesCount > 0 ? ghs(Math.round(today.revenue / today.salesCount)) : '—'}
                size="lg"
              />
            </div>
          </div>

          {/* KPI row — payment methods */}
          <div className="grid grid-cols-3 gap-px border border-line bg-line">
            <KpiCard
              label="Cash"
              value={ghs(today.byMethod.CASH)}
              sub={totalPay > 0 ? `${Math.round((today.byMethod.CASH / totalPay) * 100)}%` : undefined}
              accent="brand"
            />
            <KpiCard
              label="MoMo"
              value={ghs(today.byMethod.MOMO)}
              sub={totalPay > 0 ? `${Math.round((today.byMethod.MOMO / totalPay) * 100)}%` : undefined}
              accent="warn"
            />
            <KpiCard
              label="Credit"
              value={ghs(today.byMethod.CREDIT)}
              sub={totalPay > 0 ? `${Math.round((today.byMethod.CREDIT / totalPay) * 100)}%` : undefined}
              accent="danger"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment breakdown */}
            <div className="border border-line p-4 bg-paper">
              <SectionLabel>Payment split</SectionLabel>
              <div className="mt-3 space-y-3">
                {totalPay > 0 ? (
                  [
                    { label: 'Cash', amount: today.byMethod.CASH, color: '#0b7a4b' },
                    { label: 'MoMo', amount: today.byMethod.MOMO, color: '#b45309' },
                    { label: 'Credit', amount: today.byMethod.CREDIT, color: '#b4231e' },
                  ].map(({ label, amount, color }) => {
                    const pct = totalPay > 0 ? Math.round((amount / totalPay) * 100) : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted">{label}</span>
                          <span className="tabular-nums font-medium text-ink">
                            {ghs(amount)}{' '}
                            <span className="text-muted font-normal">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-field">
                          <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted">No sales today</p>
                )}
              </div>
            </div>

            {/* 7-day trend */}
            <div className="border border-line p-4 bg-paper">
              <SectionLabel>7-day revenue</SectionLabel>
              <div className="mt-3">
                {trendData ? (
                  <MiniTrendChart days={trendData} />
                ) : (
                  <div className="h-20 bg-field" />
                )}
              </div>
            </div>
          </div>

          {/* Alert cards */}
          {(data.discrepancyAlerts.length > 0 || data.lowStock.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.discrepancyAlerts.length > 0 && (
                <AlertCard title="Shift discrepancies" variant="danger">
                  {data.discrepancyAlerts.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2.5 gap-3">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-ink">{s.cashier.name}</span>
                        <span className="text-xs text-muted ml-2 whitespace-nowrap">
                          {s.branch.name}
                          {s.closedAt
                            ? ` · ${new Date(s.closedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                            : ''}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-mono font-semibold tabular-nums shrink-0 ${
                          (s.discrepancy ?? 0) < 0 ? 'text-danger' : 'text-ink'
                        }`}
                      >
                        {(s.discrepancy ?? 0) >= 0 ? '+' : ''}
                        {ghs(s.discrepancy ?? 0)}
                      </span>
                    </div>
                  ))}
                </AlertCard>
              )}

              {data.lowStock.length > 0 && (
                <AlertCard title="Low stock" variant="warn">
                  {data.lowStock.map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 gap-2">
                      <span className="text-sm text-ink truncate">{s.product.name}</span>
                      <span className="text-sm tabular-nums text-warn font-semibold shrink-0">
                        {s.quantity} left
                      </span>
                    </div>
                  ))}
                </AlertCard>
              )}
            </div>
          )}

          {!data.discrepancyAlerts.length && !data.lowStock.length && today.salesCount === 0 && (
            <p className="text-sm text-muted">No sales yet today. Open a shift to start selling.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold tracking-[0.14em] text-muted uppercase">{children}</p>
  );
}

function BranchBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium border ${
        active ? 'bg-ink text-paper border-ink' : 'border-line text-muted hover:bg-field hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function KpiCard({
  label,
  value,
  sub,
  size = 'sm',
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  size?: 'sm' | 'lg';
  accent?: 'brand' | 'warn' | 'danger';
}) {
  const valColor = accent
    ? ({ brand: 'text-brand', warn: 'text-warn', danger: 'text-danger' } as const)[accent]
    : 'text-ink';

  return (
    <div className="bg-paper px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`tabular-nums font-semibold mt-1 ${size === 'lg' ? 'text-2xl' : 'text-lg'} ${valColor}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub} of revenue</p>}
    </div>
  );
}

function AlertCard({
  title,
  variant,
  children,
}: {
  title: string;
  variant: 'danger' | 'warn';
  children: React.ReactNode;
}) {
  const borderClass = variant === 'danger' ? 'border-danger' : 'border-warn';
  const labelClass  = variant === 'danger' ? 'text-danger'  : 'text-warn';

  return (
    <div className={`border ${borderClass}`}>
      <p className={`px-3 py-2 text-[10px] font-bold tracking-[0.14em] uppercase border-b ${borderClass} ${labelClass} bg-paper`}>
        {title}
      </p>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

function MiniTrendChart({ days }: { days: Array<{ date: string; revenue: number; count: number }> }) {
  if (days.length === 0) return null;
  const max = Math.max(...days.map((d) => d.revenue), 1);
  const W = 280;
  const CHART_H = 68;
  const LABEL_H = 16;
  const H = CHART_H + LABEL_H;
  const slotW = W / days.length;
  const barW  = slotW - 3;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" className="w-full" style={{ height: `${H}px` }}>
      {days.map((d, i) => {
        const barH = d.revenue > 0 ? Math.max(4, (d.revenue / max) * (CHART_H - 4)) : 2;
        const x    = i * slotW + 1.5;
        const y    = CHART_H - barH;
        const dayStr = new Date(d.date + 'T12:00:00Z')
          .toLocaleDateString('en-US', { weekday: 'short' })
          .slice(0, 2);

        return (
          <g key={d.date}>
            <rect
              x={x} y={y} width={barW} height={barH}
              fill={d.revenue > 0 ? 'var(--color-brand)' : 'var(--color-line)'}
            />
            <text
              x={x + barW / 2} y={H - 2}
              textAnchor="middle"
              fontSize="9"
              fill="var(--color-muted)"
            >
              {dayStr}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
