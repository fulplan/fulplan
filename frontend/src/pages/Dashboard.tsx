import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { ProductsPage } from './ProductsPage';

type Page = 'dashboard' | 'products' | 'staff';

const NAV: { id: Page; label: string; roles?: string[] }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'products', label: 'Products' },
  { id: 'staff', label: 'Staff', roles: ['OWNER', 'MANAGER'] },
];

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

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
          <nav className="flex gap-1">
            {visibleNav.map((n) => (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className={[
                  'px-3 py-1.5 text-sm font-medium',
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
      <main className="flex-1">
        {page === 'dashboard' && <DashboardHome />}
        {page === 'products' && <ProductsPage />}
        {page === 'staff' && <StaffPlaceholder />}
      </main>
    </div>
  );
}

function DashboardHome() {
  return (
    <div className="p-5">
      <div className="border border-warn bg-field p-4 max-w-lg">
        <p className="text-sm font-semibold text-warn">Dashboard coming soon</p>
        <p className="mt-1 text-sm text-muted">
          Use the Products tab to add your inventory.
        </p>
      </div>
    </div>
  );
}

function StaffPlaceholder() {
  return (
    <div className="p-5">
      <p className="text-sm text-muted">Staff management coming soon.</p>
    </div>
  );
}
