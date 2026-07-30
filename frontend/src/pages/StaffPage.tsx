import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../lib/auth-context';

type StaffRow = {
  id: string;
  name: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER';
  email: string | null;
  branchId: string | null;
  active: boolean;
  createdAt: string;
};

type AddForm = {
  name: string;
  role: 'MANAGER' | 'CASHIER';
  pin: string;
  email: string;
  password: string;
  branchId: string;
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
};

export function StaffPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: staffList, isLoading } = trpc.staff.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();

  const [showAdd, setShowAdd] = useState(false);
  const [pinTarget, setPinTarget] = useState<StaffRow | null>(null);
  const [newPin, setNewPin] = useState('');
  const [form, setForm] = useState<AddForm>({
    name: '', role: 'CASHIER', pin: '', email: '', password: '', branchId: '',
  });
  const [err, setErr] = useState('');

  const createMut = trpc.staff.create.useMutation({
    onSuccess: () => {
      utils.staff.list.invalidate();
      setShowAdd(false);
      setForm({ name: '', role: 'CASHIER', pin: '', email: '', password: '', branchId: '' });
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  const setActiveMut = trpc.staff.setActive.useMutation({
    onSuccess: () => utils.staff.list.invalidate(),
  });

  const setPinMut = trpc.staff.setPin.useMutation({
    onSuccess: () => {
      utils.staff.list.invalidate();
      setPinTarget(null);
      setNewPin('');
    },
    onError: (e) => setErr(e.message),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    createMut.mutate({
      name: form.name,
      role: form.role,
      branchId: form.branchId || undefined,
      pin: form.role === 'CASHIER' ? form.pin : undefined,
      email: form.role === 'MANAGER' ? form.email : undefined,
      password: form.role === 'MANAGER' ? form.password : undefined,
    });
  }

  if (isLoading) {
    return <div className="p-5 text-sm text-muted">Loading staff…</div>;
  }

  const active = staffList?.filter((s) => s.active) ?? [];
  const inactive = staffList?.filter((s) => !s.active) ?? [];

  return (
    <div className="flex flex-col min-h-full">
      <div className="border-b border-line px-6 py-4 bg-paper flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-ink">Staff</h1>
          <p className="text-xs text-muted mt-0.5">Manage staff accounts and roles</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setErr(''); }}
          className="px-4 py-1.5 bg-ink text-paper text-sm font-semibold hover:opacity-80"
        >
          + Add staff
        </button>
      </div>
      <div className="px-6 py-4 max-w-2xl">

      {/* Add staff form */}
      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="border border-line p-5 mb-5 space-y-3 bg-field/30"
        >
          <p className="text-sm font-semibold text-ink">New staff member</p>

          <div className="space-y-1">
            <label className="text-xs text-muted uppercase tracking-wide">Name</label>
            <input
              className="w-full border border-line bg-field px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Full name"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted uppercase tracking-wide">Role</label>
            <select
              className="w-full border border-line bg-field px-3 py-2 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'MANAGER' | 'CASHIER' })}
            >
              <option value="CASHIER">Cashier</option>
              {user?.role === 'OWNER' && <option value="MANAGER">Manager</option>}
            </select>
          </div>

          {branches && branches.length > 1 && (
            <div className="space-y-1">
              <label className="text-xs text-muted uppercase tracking-wide">Branch</label>
              <select
                className="w-full border border-line bg-field px-3 py-2 text-sm"
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.role === 'CASHIER' ? (
            <div className="space-y-1">
              <label className="text-xs text-muted uppercase tracking-wide">PIN (4–6 digits)</label>
              <input
                className="w-full border border-line bg-field px-3 py-2 text-sm font-mono tracking-widest"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                required
                placeholder="••••"
              />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted uppercase tracking-wide">Email</label>
                <input
                  className="w-full border border-line bg-field px-3 py-2 text-sm"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="manager@email.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted uppercase tracking-wide">Password</label>
                <input
                  className="w-full border border-line bg-field px-3 py-2 text-sm"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
                />
              </div>
            </>
          )}

          {err && <p className="text-sm text-danger">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="px-4 py-2 text-sm font-semibold bg-ink text-paper hover:opacity-80 disabled:opacity-50"
            >
              {createMut.isPending ? 'Adding…' : 'Add staff'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setErr(''); }}
              className="px-4 py-2 text-sm border border-line text-muted hover:bg-field hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Change PIN modal */}
      {pinTarget && (
        <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4">
          <div className="bg-paper border border-line w-full max-w-xs">
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Change PIN — {pinTarget.name}</p>
            </div>
            <div className="p-4 space-y-3">
            <input
              className="w-full border border-line bg-field px-3 py-2 text-sm font-mono tracking-widest"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="New PIN (4–6 digits)"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            {err && <p className="text-xs text-danger">{err}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setErr('');
                  setPinMut.mutate({ userId: pinTarget.id, pin: newPin });
                }}
                disabled={setPinMut.isPending || newPin.length < 4}
                className="px-4 py-2 text-sm font-semibold bg-ink text-paper hover:opacity-80 disabled:opacity-50"
              >
                {setPinMut.isPending ? 'Saving…' : 'Save PIN'}
              </button>
              <button
                onClick={() => { setPinTarget(null); setNewPin(''); setErr(''); }}
                className="px-4 py-2 text-sm border border-line text-muted hover:bg-field hover:text-ink"
              >
                Cancel
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Active staff */}
      <StaffTable
        rows={active}
        onToggleActive={(s) => setActiveMut.mutate({ userId: s.id, active: false })}
        onChangePin={(s) => { setPinTarget(s); setErr(''); }}
        currentUserId={user?.id}
        branches={branches ?? []}
        deactivateLabel="Deactivate"
      />

      {/* Inactive staff */}
      {inactive.length > 0 && (
        <div className="mt-6">
          <p className="text-xs text-muted uppercase tracking-wide mb-2">Inactive</p>
          <StaffTable
            rows={inactive}
            onToggleActive={(s) => setActiveMut.mutate({ userId: s.id, active: true })}
            onChangePin={(s) => { setPinTarget(s); setErr(''); }}
            currentUserId={user?.id}
            branches={branches ?? []}
            deactivateLabel="Re-activate"
          />
        </div>
      )}
      </div>
    </div>
  );
}

function StaffTable({
  rows,
  onToggleActive,
  onChangePin,
  currentUserId,
  branches,
  deactivateLabel,
}: {
  rows: StaffRow[];
  onToggleActive: (s: StaffRow) => void;
  onChangePin: (s: StaffRow) => void;
  currentUserId?: string;
  branches: { id: string; name: string }[];
  deactivateLabel: string;
}) {
  if (rows.length === 0) return null;

  const branchName = (id: string | null) =>
    branches.find((b) => b.id === id)?.name ?? '—';

  return (
    <div className="border border-line divide-y divide-line">
      {rows.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{s.name}</p>
            <p className="text-xs text-muted">
              {ROLE_LABEL[s.role]}
              {s.branchId ? ` · ${branchName(s.branchId)}` : ''}
              {s.email ? ` · ${s.email}` : ''}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {s.role === 'CASHIER' && (
              <button
                onClick={() => onChangePin(s)}
                className="text-xs border border-line px-2 py-1 hover:bg-field"
              >
                PIN
              </button>
            )}
            {s.id !== currentUserId && s.role !== 'OWNER' && (
              <button
                onClick={() => onToggleActive(s)}
                className="text-xs border border-line px-2 py-1 hover:bg-field"
              >
                {deactivateLabel}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
