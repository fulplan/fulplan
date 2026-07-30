import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { trpc } from '../lib/trpc';
import { useOnline } from '../lib/use-online';
import { count as queueCount } from '../lib/offline-queue';
import { drainQueue } from '../lib/sale-sync';
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

type NavItem = { id: Page; label: string; roles?: string[]; icon: string };
type NavGroup = { label: string; items: NavItem[] };

// Heroicons outline paths (24×24 viewBox, stroke)
const ICON_PATHS: Record<string, string> = {
  home:      "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  checkout:  "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
  shift:     "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  products:  "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  stocktake: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  suppliers: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1",
  customers: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  expenses:  "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  reports:   "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  history:   "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  staff:     "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  settings:  "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
};

function NavIcon({ name, active }: { name: string; active?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.8}
      stroke="currentColor"
      className="w-4 h-4 shrink-0"
      style={{ opacity: active ? 1 : 0.65 }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[name] ?? ''} />
    </svg>
  );
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ id: 'home', label: 'Dashboard', icon: 'home', roles: ['OWNER', 'MANAGER'] }],
  },
  {
    label: 'Sell',
    items: [
      { id: 'checkout', label: 'Checkout', icon: 'checkout' },
      { id: 'shift', label: 'Shift', icon: 'shift' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { id: 'products', label: 'Products', icon: 'products', roles: ['OWNER', 'MANAGER'] },
      { id: 'stocktake', label: 'Stock take', icon: 'stocktake', roles: ['OWNER', 'MANAGER'] },
      { id: 'suppliers', label: 'Suppliers', icon: 'suppliers', roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'customers', label: 'Customers', icon: 'customers', roles: ['OWNER', 'MANAGER'] },
      { id: 'expenses', label: 'Expenses', icon: 'expenses', roles: ['OWNER', 'MANAGER'] },
      { id: 'reports', label: 'Reports', icon: 'reports', roles: ['OWNER', 'MANAGER'] },
      { id: 'history', label: 'Sales history', icon: 'history', roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: 'staff', label: 'Staff', icon: 'staff', roles: ['OWNER', 'MANAGER'] },
      { id: 'settings', label: 'Settings', icon: 'settings', roles: ['OWNER', 'MANAGER'] },
    ],
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
  onEnterAdmin?: () => void;
  isAdmin?: boolean;
};

function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem('ghpos:nav:collapsed') ?? '[]'));
  } catch {
    return new Set();
  }
}

function Sidebar({ page, onNavigate, visibleGroups, userName, userRole, orgName, onSignOut, onEnterAdmin, isAdmin }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);

  function toggleGroup(label: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      localStorage.setItem('ghpos:nav:collapsed', JSON.stringify([...next]));
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Brand / org */}
      <div className="px-4 pt-5 pb-4 border-b border-line">
        <p className="text-[10px] font-bold tracking-[0.18em] text-muted uppercase">GhPOS</p>
        <p className="text-sm font-semibold text-ink mt-1 truncate leading-tight">{orgName}</p>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2">
        {visibleGroups.map((group) => {
          const isCollapsed = collapsed.has(group.label);
          const hasActive = group.items.some(i => i.id === page);
          return (
            <div key={group.label} className="mb-0.5">
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-field/60 transition-colors"
              >
                <span className="text-[10px] font-bold tracking-[0.14em] text-muted uppercase">
                  {group.label}
                </span>
                <span
                  className="text-muted text-xs leading-none transition-transform duration-150"
                  style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', display: 'inline-block' }}
                >
                  ›
                </span>
              </button>
              {!isCollapsed && (
                <div>
                  {group.items.map((item) => {
                    const active = page === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={[
                          'w-full text-left text-sm py-[7px] border-l-2 transition-colors flex items-center gap-2.5',
                          active
                            ? 'bg-field text-ink font-semibold border-brand pl-[14px] pr-4'
                            : 'text-muted hover:bg-field hover:text-ink border-transparent pl-[14px] pr-4',
                        ].join(' ')}
                      >
                        <NavIcon name={item.icon} active={active} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* keep a subtle indicator on collapsed groups that have the active item */}
              {isCollapsed && hasActive && (
                <div className="h-0.5 mx-4 bg-brand opacity-40" />
              )}
            </div>
          );
        })}
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
        {isAdmin && onEnterAdmin && (
          <button
            onClick={onEnterAdmin}
            className="mt-2 w-full text-left text-[11px] text-brand hover:underline flex items-center gap-1"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Platform admin
          </button>
        )}
      </div>
    </div>
  );
}

// ─── App shell ────────────────────────────────────────────────────────────────

export function Dashboard({ onEnterAdmin }: { onEnterAdmin?: () => void }) {
  const { user, signOut } = useAuth();
  const [page, setPage] = useState<Page>(() => defaultPage(user?.role ?? 'CASHIER'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: isAdmin } = trpc.superAdmin.isAdmin.useQuery(undefined, {
    enabled: !!user && user.role === 'OWNER',
    staleTime: 60_000,
  });

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
    onEnterAdmin,
    isAdmin: !!isAdmin,
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
        <OfflineBar />
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

// ─── Offline bar ─────────────────────────────────────────────────────────────

function OfflineBar() {
  const isOnline = useOnline();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const completeMutation = trpc.sales.complete.useMutation();

  // Poll queue depth every 5s
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const n = await queueCount();
      if (!cancelled) setPending(n);
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Drain when we come back online
  useEffect(() => {
    if (!isOnline || pending === 0) return;
    setSyncing(true);
    drainQueue((input) => completeMutation.mutateAsync(input as Parameters<typeof completeMutation.mutateAsync>[0]))
      .then(({ synced, failed }) => {
        setSyncing(false);
        setSyncMsg(failed > 0 ? `${synced} synced, ${failed} failed` : `${synced} sale${synced !== 1 ? 's' : ''} synced`);
        setPending(failed);
        setTimeout(() => setSyncMsg(''), 4000);
      })
      .catch(() => setSyncing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  if (isOnline && pending === 0 && !syncMsg) return null;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-xs font-medium ${
      !isOnline ? 'bg-warn/10 text-warn' : 'bg-brand/10 text-brand'
    }`}>
      {!isOnline ? (
        <>
          <span className="h-2 w-2 rounded-full bg-warn" />
          Offline — {pending > 0 ? `${pending} sale${pending !== 1 ? 's' : ''} queued` : 'sales will be queued locally'}
        </>
      ) : syncing ? (
        <>
          <span className="h-2 w-2 rounded-full bg-brand animate-ping" />
          Syncing {pending} queued sale{pending !== 1 ? 's' : ''}…
        </>
      ) : syncMsg ? (
        <>
          <span className="h-2 w-2 rounded-full bg-brand" />
          {syncMsg}
        </>
      ) : null}
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
  const { data, isLoading, isFetching } = trpc.reports.dashboard.useQuery(
    { branchId },
    { refetchInterval: 30_000 },
  );

  const trendDates = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const { data: trendData } = trpc.reports.dailyTrend.useQuery(
    { ...trendDates, branchId },
    { refetchInterval: 30_000 },
  );

  const multiBranch = (branches?.length ?? 0) > 1;
  const today = data?.today;
  const totalPay = (today?.byMethod.CASH ?? 0) + (today?.byMethod.MOMO ?? 0) + (today?.byMethod.CREDIT ?? 0);

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const PAY_METHODS = [
    { label: 'Cash',   key: 'CASH'   as const, color: '#0b7a4b', textClass: 'text-brand'  },
    { label: 'MoMo',   key: 'MOMO'   as const, color: '#b45309', textClass: 'text-warn'   },
    { label: 'Credit', key: 'CREDIT' as const, color: '#b4231e', textClass: 'text-danger' },
  ];

  return (
    <div className="flex flex-col min-h-full">
      {/* Page header */}
      <div className="border-b border-line px-6 py-4 flex items-center justify-between gap-4 bg-paper">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm font-semibold text-ink tracking-tight">Dashboard</h1>
            <p className="text-xs text-muted mt-0.5">{todayLabel}</p>
          </div>
          <LiveBadge active={isFetching} interval={30} />
          <LiveClock />
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

          {/* Hero revenue card */}
          <div className="bg-ink text-paper px-7 py-6 relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-paper/40 mb-2">Today's revenue</p>
              <p className="text-[2.75rem] font-bold tabular-nums leading-none tracking-tight">
                {ghs(today.revenue)}
              </p>
              <div className="flex gap-8 mt-5 border-t border-paper/10 pt-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-paper/40">Transactions</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">{today.salesCount}</p>
                </div>
                {today.salesCount > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-paper/40">Avg sale</p>
                    <p className="text-2xl font-bold mt-1 tabular-nums">
                      {ghs(Math.round(today.revenue / today.salesCount))}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div
              className="absolute right-0 top-0 bottom-0 w-64 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 80% 50%, rgba(255,255,255,0.06) 0%, transparent 70%)' }}
            />
          </div>

          {/* Payment methods */}
          <div>
            <SectionLabel>Payment methods</SectionLabel>
            <div className="grid grid-cols-3 gap-px bg-line border border-line mt-2">
              {PAY_METHODS.map(({ label, key, color, textClass }) => {
                const amt = today.byMethod[key];
                const pct = totalPay > 0 ? Math.round((amt / totalPay) * 100) : 0;
                return (
                  <div key={label} className="bg-paper px-5 py-5">
                    <div className="h-0.5 w-8 mb-4" style={{ background: color }} />
                    <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted">{label}</p>
                    <p className={`text-xl font-bold tabular-nums mt-1.5 ${textClass}`}>{ghs(amt)}</p>
                    {totalPay > 0 && (
                      <>
                        <div className="mt-3 h-1 w-full bg-field rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: color }}
                          />
                        </div>
                        <p className="text-[11px] text-muted mt-1.5">{pct}% of revenue</p>
                      </>
                    )}
                    {totalPay === 0 && (
                      <p className="text-[11px] text-muted mt-2">No sales yet</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live transaction feed */}
          <LiveTransactionFeed branchId={branchId} />

          {/* 7-day trend */}
          <div className="border border-line bg-paper">
            <div className="flex items-center justify-between px-5 py-3 border-b border-line">
              <SectionLabel>7-day revenue</SectionLabel>
              {trendData && trendData.length > 0 && (
                <span className="text-[10px] text-muted">
                  {new Date(trendData[0]!.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  {' – '}
                  {new Date(trendData[trendData.length - 1]!.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>
            <div className="px-5 py-4">
              {trendData && trendData.length > 0 ? (
                <MiniTrendChart days={trendData} />
              ) : (
                <div className="h-24 bg-field flex items-center justify-center">
                  <p className="text-xs text-muted">No data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Alerts */}
          {(data.discrepancyAlerts.length > 0 || data.lowStock.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.discrepancyAlerts.length > 0 && (
                <AlertCard title="Shift discrepancies" variant="danger">
                  {data.discrepancyAlerts.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3 gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{s.cashier.name}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {s.branch.name}
                          {s.closedAt
                            ? ` · ${new Date(s.closedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                            : ''}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-mono font-bold tabular-nums shrink-0 ${
                          (s.discrepancy ?? 0) < 0 ? 'text-danger' : 'text-ink'
                        }`}
                      >
                        {(s.discrepancy ?? 0) >= 0 ? '+' : ''}{ghs(s.discrepancy ?? 0)}
                      </span>
                    </div>
                  ))}
                </AlertCard>
              )}

              {data.lowStock.length > 0 && (
                <AlertCard title="Low stock" variant="warn">
                  {data.lowStock.map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3 gap-2">
                      <span className="text-sm text-ink truncate">{s.product.name}</span>
                      <span className="text-sm tabular-nums text-warn font-bold shrink-0">{s.quantity} left</span>
                    </div>
                  ))}
                </AlertCard>
              )}
            </div>
          )}

          {!data.discrepancyAlerts.length && !data.lowStock.length && today.salesCount === 0 && (
            <div className="border border-dashed border-line px-6 py-10 text-center">
              <p className="text-sm font-medium text-ink">No sales yet today</p>
              <p className="text-xs text-muted mt-1">Open a shift to start selling.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden sm:block text-right">
      <p className="text-base font-mono font-bold tabular-nums text-ink leading-none">
        {now.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
      </p>
      <p className="text-[10px] text-muted mt-0.5">
        {now.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
    </div>
  );
}

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


function AlertCard({
  title,
  variant,
  children,
}: {
  title: string;
  variant: 'danger' | 'warn';
  children: React.ReactNode;
}) {
  const accentColor = variant === 'danger' ? '#b4231e' : '#b45309';
  const labelClass  = variant === 'danger' ? 'text-danger' : 'text-warn';

  return (
    <div className="border border-line bg-paper overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-line">
        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentColor }} />
        <p className={`text-[10px] font-bold tracking-[0.14em] uppercase ${labelClass}`}>{title}</p>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

// ─── Live transaction feed ────────────────────────────────────────────────────

function formatTxTime(d: Date | string): { time: string; date: string | null; rel: string } {
  const dt = new Date(d);
  const now = new Date();
  const isToday =
    dt.getDate() === now.getDate() &&
    dt.getMonth() === now.getMonth() &&
    dt.getFullYear() === now.getFullYear();
  const time = dt.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = isToday ? null : dt.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
  const mins = Math.floor((now.getTime() - dt.getTime()) / 60_000);
  const rel = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
  return { time, date, rel };
}

const PM_STYLE: Record<string, [string, string]> = {
  CASH:   ['bg-brand/10 text-brand',   'Cash'],
  MOMO:   ['bg-warn/10 text-warn',     'MoMo'],
  CREDIT: ['bg-danger/10 text-danger', 'Credit'],
  SPLIT:  ['bg-field text-ink',        'Split'],
};

function PayMethodBadge({ method }: { method: string }) {
  const [cls, label] = PM_STYLE[method] ?? ['bg-field text-muted', method];
  return (
    <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-[2px] ${cls}`}>
      {label}
    </span>
  );
}

function LiveTransactionFeed({ branchId }: { branchId?: string }) {
  const { data: sales, isFetching, dataUpdatedAt } = trpc.sales.list.useQuery(
    { limit: 10, branchId },
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
    ? lastUpdated.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : null;

  return (
    <div className="border border-line">
      <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-field/40">
        <SectionLabel>Live transactions</SectionLabel>
        <span className="text-[10px] text-muted font-mono tabular-nums">
          {isFetching ? (
            <span className="text-brand font-bold animate-pulse">Updating…</span>
          ) : updatedStr ? (
            <>Updated <span className="text-ink font-semibold">{updatedStr}</span></>
          ) : null}
        </span>
      </div>
      {!sales || sales.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted">No transactions yet</div>
      ) : (
        <div className="divide-y divide-line">
          {sales.map((sale) => {
            const itemSummary = sale.items
              .map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name))
              .join(', ');
            const { time, date, rel } = formatTxTime(sale.createdAt);
            const isNew = sale.id === flashId;
            return (
              <div
                key={sale.id}
                className={`flex items-center gap-3 px-5 py-2.5 transition-colors duration-700 ${isNew ? 'bg-brand/10' : ''}`}
              >
                <PayMethodBadge method={sale.paymentMethod} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink truncate">{itemSummary || '—'}</p>
                  <p className="text-xs text-muted mt-0.5">{sale.cashier.name}</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-bold tabular-nums">{ghs(sale.total)}</p>
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

function MiniTrendChart({ days }: { days: Array<{ date: string; revenue: number; count: number }> }) {
  if (days.length === 0) return null;
  const max = Math.max(...days.map((d) => d.revenue), 1);
  const W = 320;
  const CHART_H = 96;
  const LABEL_H = 18;
  const H = CHART_H + LABEL_H;
  const slotW = W / days.length;
  const barW  = Math.max(slotW - 5, 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" className="w-full" style={{ height: `${H}px` }}>
      {days.map((d, i) => {
        const barH = d.revenue > 0 ? Math.max(5, (d.revenue / max) * (CHART_H - 8)) : 3;
        const x    = i * slotW + (slotW - barW) / 2;
        const y    = CHART_H - barH;
        const dayStr = new Date(d.date + 'T12:00:00Z')
          .toLocaleDateString('en-US', { weekday: 'short' })
          .slice(0, 2);

        return (
          <g key={d.date}>
            <rect
              x={x} y={y} width={barW} height={barH}
              fill={d.revenue > 0 ? 'var(--color-brand)' : 'var(--color-line)'}
              opacity={d.revenue > 0 ? 0.85 : 1}
            />
            <text
              x={i * slotW + slotW / 2} y={H - 3}
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
