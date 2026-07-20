import { useAuth } from '../lib/auth-context';

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
};

export function Dashboard() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b-2 border-ink px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">GhPOS</h1>
            <p className="mt-0.5 text-sm text-muted">{user.organizationName}</p>
          </div>
          <button
            onClick={signOut}
            className="border border-line px-3 py-1.5 text-sm hover:bg-field"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 p-5">
        <div className="mb-6 border border-line p-4">
          <p className="text-sm text-muted">Signed in as</p>
          <p className="mt-1 text-base font-semibold">{user.name}</p>
          <p className="text-sm text-muted">{ROLE_LABEL[user.role] ?? user.role}</p>
        </div>

        <div className="border border-warn bg-field p-4">
          <p className="text-sm font-semibold text-warn">Dashboard coming soon</p>
          <p className="mt-1 text-sm text-muted">
            Auth is working. Products, checkout, reports, and inventory are next.
          </p>
        </div>
      </main>
    </div>
  );
}
