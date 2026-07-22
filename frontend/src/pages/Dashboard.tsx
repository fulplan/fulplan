import { useState } from 'react';
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
import { SettingsPage } from './SettingsPage';
import { StaffPage } from './StaffPage';

type Page = 'checkout' | 'shift' | 'dashboard' | 'products' | 'customers' | 'suppliers' | 'stocktake' | 'expenses' | 'reports' | 'settings' | 'staff';

const NAV: { id: Page; label: string; roles?: string[] }[] = [
  { id: 'checkout', label: 'Checkout' },
  { id: 'shift', label: 'Shift' },
  { id: 'dashboard', label: 'Dashboard', roles: ['OWNER', 'MANAGER'] },
  { id: 'products', label: 'Products', roles: ['OWNER', 'MANAGER'] },
  { id: 'stocktake', label: 'Stock take', roles: ['OWNER', 'MANAGER'] },
  { id: 'customers', label: 'Customers', roles: ['OWNER', 'MANAGER'] },
  { id: 'suppliers', label: 'Suppliers', roles: ['OWNER', 'MANAGER'] },
  { id: 'expenses', label: 'Expenses', roles: ['OWNER', 'MANAGER'] },
  { id: 'reports', label: 'Reports', roles: ['OWNER', 'MANAGER'] },
  { id: 'settings', label: 'Settings', roles: ['OWNER', 'MANAGER'] },
  { id: 'staff', label: 'Staff', roles: ['OWNER', 'MANAGER'] },
];

function defaultPage(role: string): Page {
  return role === 'CASHIER' ? 'checkout' : 'dashboard';
}

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [page, setPage] = useState<Page>(() =>
    defaultPage(user?.role ?? 'CASHIER'),
  );

  if (!user) return null;

  const visibleNav = NAV.filter(
    (n) => !n.roles || n.roles.includes(user.role),
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="border-b-2 border-ink px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <span className="text-base font-semibold tracking-tight">
            {user.organizationName}
          </span>
          <nav className="flex gap-1 overflow-x-auto">
            {visibleNav.map((n) => (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className={[
                  'px-3 py-1.5 text-sm font-medium shrink-0',
                  page === n.id
                    ? 'bg-ink text-paper'
                    : 'text-muted hover:bg-field',
                ].join(' ')}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{user.name}</span>
          <button
            onClick={signOut}
            className="border border-line px-3 py-1.5 text-sm hover:bg-field"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex flex-1 flex-col">
        {page === 'checkout' && <CheckoutPage />}
        {page === 'shift' && <ShiftPage />}
        {page === 'dashboard' && <DashboardHome />}
        {page === 'products' && <ProductsPage />}
        {page === 'customers' && <CustomersPage />}
        {page === 'suppliers' && <SuppliersPage />}
        {page === 'stocktake' && <StockTakePage />}
        {page === 'expenses' && <SalaryExpensesPage />}
        {page === 'reports' && <ReportsPage />}
        {page === 'settings' && <SettingsPage />}
        {page === 'staff' && <StaffPage />}
      </main>
    </div>
  );
}

function ghs(pesewas: number) {
  return `GH₵ ${(pesewas / 100).toFixed(2)}`;
}

function DashboardHome() {
  const { data, isLoading } = trpc.reports.dashboard.useQuery({ branchId: undefined });

  if (isLoading) {
    return <div className="p-5 text-sm text-muted">Loading…</div>;
  }

  if (!data) return null;

  const { today, discrepancyAlerts, lowStock } = data;
  const hasAlerts = discrepancyAlerts.length > 0 || lowStock.length > 0;

  return (
    <div className="p-5 space-y-6 max-w-2xl">
      {/* Today's snapshot */}
      <section>
        <p className="text-xs text-muted uppercase tracking-wide mb-3">Today</p>
        <div className="grid grid-cols-2 gap-px border border-line bg-line">
          <Metric label="Revenue" value={ghs(today.revenue)} large />
          <Metric label="Transactions" value={String(today.salesCount)} large />
          <Metric label="Cash" value={ghs(today.byMethod.CASH)} />
          <Metric label="MoMo" value={ghs(today.byMethod.MOMO)} />
          <Metric label="Credit" value={ghs(today.byMethod.CREDIT)} />
          <Metric
            label="Avg sale"
            value={today.salesCount > 0 ? ghs(Math.round(today.revenue / today.salesCount)) : '—'}
          />
        </div>
      </section>

      {/* Discrepancy alerts */}
      {discrepancyAlerts.length > 0 && (
        <section>
          <p className="text-xs text-muted uppercase tracking-wide mb-2">
            Shift discrepancy alerts
          </p>
          <div className="border border-danger divide-y divide-line">
            {discrepancyAlerts.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 gap-3">
                <div>
                  <span className="text-sm font-medium">{s.cashier.name}</span>
                  <span className="text-xs text-muted ml-2">
                    {s.branch.name} ·{' '}
                    {s.closedAt
                      ? new Date(s.closedAt).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short',
                        })
                      : ''}
                  </span>
                </div>
                <span
                  className={`text-sm font-mono font-semibold tabular-nums ${
                    (s.discrepancy ?? 0) < 0 ? 'text-danger' : 'text-ink'
                  }`}
                >
                  {(s.discrepancy ?? 0) >= 0 ? '+' : ''}
                  {ghs(s.discrepancy ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <section>
          <p className="text-xs text-muted uppercase tracking-wide mb-2">Low stock</p>
          <div className="border border-warn divide-y divide-line">
            {lowStock.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm">{s.product.name}</span>
                <span className="text-sm tabular-nums text-warn font-semibold">
                  {s.quantity} left
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!hasAlerts && today.salesCount === 0 && (
        <p className="text-sm text-muted">No sales yet today. Open a shift in the Shift tab to start selling.</p>
      )}
    </div>
  );
}

function Metric({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div className="bg-paper px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`tabular-nums font-semibold mt-0.5 ${large ? 'text-2xl' : 'text-lg'}`}>
        {value}
      </p>
    </div>
  );
}
