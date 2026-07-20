import { useState } from 'react';
import type { SessionUser } from '../lib/auth-context';
import { getDeviceToken } from '../lib/storage';
import { trpc } from '../lib/trpc';

interface Props {
  onSignedIn: (token: string, user: SessionUser, deviceToken?: string | null) => void;
  onOwnerLoginClick: () => void;
}

type View = 'staff_list' | 'pin_entry';

const PIN_MAX = 6;

export function PinScreen({ onSignedIn, onOwnerLoginClick }: Props) {
  const deviceToken = getDeviceToken();

  const staffQuery = trpc.staff.listForDevice.useQuery(
    { deviceToken: deviceToken! },
    { enabled: !!deviceToken, retry: 1 },
  );

  const [view, setView] = useState<View>('staff_list');
  const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string } | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const pinLoginMutation = trpc.auth.pinLogin.useMutation({
    onSuccess(data) {
      onSignedIn(
        data.token,
        {
          id: data.user.id,
          name: data.user.name,
          role: data.user.role,
          organizationId: data.organization.id,
          organizationName: data.organization.name,
          branchId: null, // populated on next load via auth.me
        },
        data.deviceToken,
      );
    },
    onError(err) {
      setError(err.message);
      setPin('');
    },
  });

  function selectCashier(staff: { id: string; name: string }) {
    setSelectedStaff(staff);
    setPin('');
    setError('');
    setView('pin_entry');
  }

  function pressKey(key: string) {
    if (key === '←') {
      setPin((p) => p.slice(0, -1));
      setError('');
      return;
    }
    if (key === '✓') {
      submit();
      return;
    }
    setPin((p) => {
      const next = p + key;
      return next.length <= PIN_MAX ? next : p;
    });
    setError('');
  }

  function submit() {
    if (!selectedStaff || pin.length < 4) return;
    setError('');
    pinLoginMutation.mutate({ userId: selectedStaff.id, pin });
  }

  const shopName = staffQuery.data?.organizationName ?? '';

  // ── Device not registered ─────────────────────────────────────────────────
  if (!deviceToken || staffQuery.isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-sm text-muted">
            {!deviceToken
              ? 'This device has not been registered yet.'
              : 'This device is no longer authorised.'}
          </p>
          <p className="mt-1 text-sm text-muted">
            Ask the shop owner to sign in and register it.
          </p>
          <button
            onClick={onOwnerLoginClick}
            className="mt-4 text-sm text-muted underline"
          >
            Sign in as owner
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (staffQuery.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  const staff = staffQuery.data.staff;

  // ── Staff list ────────────────────────────────────────────────────────────
  if (view === 'staff_list') {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="border-b-2 border-ink px-5 py-4">
          <h1 className="text-xl font-semibold tracking-tight">{shopName}</h1>
          <p className="mt-0.5 text-sm text-muted">Select your name to sign in</p>
        </header>

        {staff.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <p className="text-sm text-muted">No cashiers set up yet.</p>
            <p className="mt-1 text-sm text-muted">
              Ask the owner to add staff in the management screen.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {staff.map((member, i) => (
              <button
                key={member.id}
                onClick={() => selectCashier(member)}
                className={`flex w-full items-center px-5 text-left text-base font-medium hover:bg-field active:bg-line ${
                  i < staff.length - 1 ? 'border-b border-line' : ''
                }`}
                style={{ height: 'var(--spacing-touch-lg)' }}
              >
                {member.name}
              </button>
            ))}
          </div>
        )}

        <footer className="border-t border-line px-5 py-3 text-center">
          <button onClick={onOwnerLoginClick} className="text-sm text-muted underline">
            Sign in as owner / manager
          </button>
        </footer>
      </div>
    );
  }

  // ── PIN entry ─────────────────────────────────────────────────────────────
  const dots = Array.from({ length: PIN_MAX }, (_, i) => i < pin.length);

  const keypad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['←', '0', '✓'],
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line px-5 py-4">
        <button
          onClick={() => { setView('staff_list'); setPin(''); setError(''); }}
          className="mb-1 text-sm text-muted underline"
        >
          ← Back
        </button>
        <h2 className="text-xl font-semibold">{selectedStaff?.name}</h2>
        <p className="mt-0.5 text-sm text-muted">{shopName}</p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        {/* PIN dots */}
        <div className="flex gap-4" aria-label="PIN entry" role="status">
          {dots.map((filled, i) => (
            <span
              key={i}
              className={`inline-block size-4 border-2 ${filled ? 'border-ink bg-ink' : 'border-line bg-paper'}`}
            />
          ))}
        </div>

        {/* Error */}
        <p className={`text-sm text-danger transition-opacity ${error ? 'opacity-100' : 'opacity-0'}`}>
          {error || ' '}
        </p>

        {/* Keypad */}
        <div className="w-full max-w-xs">
          {keypad.map((row) => (
            <div key={row.join('')} className="grid grid-cols-3">
              {row.map((key) => {
                const isConfirm = key === '✓';
                const isDisabledConfirm = isConfirm && (pin.length < 4 || pinLoginMutation.isPending);

                return (
                  <button
                    key={key}
                    onClick={() => pressKey(key)}
                    disabled={isDisabledConfirm}
                    className={[
                      'border border-line text-xl font-semibold',
                      'active:bg-field disabled:opacity-30',
                      isConfirm ? 'bg-brand text-paper hover:opacity-90' : 'bg-paper hover:bg-field',
                    ].join(' ')}
                    style={{ height: 'var(--spacing-touch-lg)' }}
                  >
                    {pinLoginMutation.isPending && isConfirm ? '…' : key}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
