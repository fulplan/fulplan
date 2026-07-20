import { useState } from 'react';
import type { SessionUser } from '../lib/auth-context';
import { trpc } from '../lib/trpc';

interface Props {
  onSignedIn: (token: string, user: SessionUser, deviceToken?: string | null) => void;
  onSignupClick: () => void;
  onPinClick?: () => void;
}

type Step = 'credentials' | 'choose_org';

export function LoginPage({ onSignedIn, onSignupClick, onPinClick }: Props) {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess(data) {
      if (data.status === 'choose_organization') {
        setOrgs(data.organizations);
        setStep('choose_org');
        return;
      }
      onSignedIn(
        data.token,
        {
          id: data.user.id,
          name: data.user.name,
          role: data.user.role,
          organizationId: data.organization.id,
          organizationName: data.organization.name,
        },
        data.deviceToken,
      );
    },
    onError(err) {
      setError(err.message);
    },
  });

  function submitCredentials(organizationId?: string) {
    setError('');
    loginMutation.mutate({
      email,
      password,
      organizationId,
      deviceLabel: deviceLabel.trim() || undefined,
    });
  }

  if (step === 'choose_org') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <header className="mb-6 border-b-2 border-ink pb-4">
            <h1 className="text-xl font-semibold tracking-tight">GhPOS</h1>
            <p className="mt-1 text-sm text-muted">Which shop?</p>
          </header>

          <p className="mb-4 text-sm text-muted">
            This email is linked to multiple shops. Choose one to continue.
          </p>

          <div className="border border-line">
            {orgs.map((org, i) => (
              <button
                key={org.id}
                onClick={() => submitCredentials(org.id)}
                disabled={loginMutation.isPending}
                className={`block w-full px-4 text-left text-base font-medium hover:bg-field active:bg-line disabled:opacity-50 ${
                  i < orgs.length - 1 ? 'border-b border-line' : ''
                }`}
                style={{ height: 'var(--spacing-touch)' }}
              >
                {org.name}
              </button>
            ))}
          </div>

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <button
            onClick={() => { setStep('credentials'); setError(''); }}
            className="mt-4 text-sm text-muted underline"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <header className="mb-8 border-b-2 border-ink pb-4">
          <h1 className="text-xl font-semibold tracking-tight">GhPOS</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your shop</p>
        </header>

        <form
          onSubmit={(e) => { e.preventDefault(); submitCredentials(); }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full border border-line bg-field px-3 py-2.5 text-base"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full border border-line bg-field px-3 py-2.5 text-base"
            />
          </div>

          <details className="border border-line bg-field p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              Register this device for cashier PIN login
            </summary>
            <p className="mt-2 text-muted">
              Give this device a name so cashiers can sign in with their PIN
              instead of a password. Leave blank to skip.
            </p>
            <input
              type="text"
              placeholder="e.g. Main Counter, Till 2"
              value={deviceLabel}
              onChange={(e) => setDeviceLabel(e.target.value)}
              className="mt-2 block w-full border border-line bg-paper px-3 py-2.5 text-base"
            />
          </details>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="flex w-full items-center justify-center bg-brand text-base font-semibold text-paper disabled:opacity-50"
            style={{ height: 'var(--spacing-touch-lg)' }}
          >
            {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center text-sm">
          <button onClick={onSignupClick} className="block w-full text-muted underline">
            New shop? Create your account
          </button>
          {onPinClick && (
            <button onClick={onPinClick} className="block w-full text-muted underline">
              Switch to cashier PIN screen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
