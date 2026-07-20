import { useState } from 'react';
import type { SessionUser } from '../lib/auth-context';
import { trpc } from '../lib/trpc';

interface Props {
  onSignedUp: (token: string, user: SessionUser) => void;
  onLoginClick: () => void;
}

export function SignupPage({ onSignedUp, onLoginClick }: Props) {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [branchName, setBranchName] = useState('Main Branch');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess(data) {
      onSignedUp(data.token, {
        id: data.user.id,
        name: data.user.name,
        role: 'OWNER',
        organizationId: data.organization.id,
        organizationName: data.organization.name,
      });
    },
    onError(err) {
      setError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    signupMutation.mutate({
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      email: email.trim(),
      password,
      branchName: branchName.trim() || 'Main Branch',
      referralCode: referralCode.trim() || undefined,
    });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <header className="mb-8 border-b-2 border-ink pb-4">
          <h1 className="text-xl font-semibold tracking-tight">GhPOS</h1>
          <p className="mt-1 text-sm text-muted">Create your shop — free for 30 days</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="shop-name">
              Shop name
            </label>
            <input
              id="shop-name"
              type="text"
              required
              minLength={2}
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="block w-full border border-line bg-field px-3 py-2.5 text-base"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="owner-name">
              Your name
            </label>
            <input
              id="owner-name"
              type="text"
              required
              minLength={2}
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="block w-full border border-line bg-field px-3 py-2.5 text-base"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="signup-email">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full border border-line bg-field px-3 py-2.5 text-base"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="signup-password">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full border border-line bg-field px-3 py-2.5 text-base"
            />
            <p className="mt-1 text-xs text-muted">At least 8 characters</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="branch-name">
              First branch name
            </label>
            <input
              id="branch-name"
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="block w-full border border-line bg-field px-3 py-2.5 text-base"
            />
            <p className="mt-1 text-xs text-muted">You can add more branches later</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="referral">
              Referral code{' '}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="referral"
              type="text"
              maxLength={12}
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className="block w-full border border-line bg-field px-3 py-2.5 text-base uppercase"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={signupMutation.isPending}
            className="flex w-full items-center justify-center bg-brand text-base font-semibold text-paper disabled:opacity-50"
            style={{ height: 'var(--spacing-touch-lg)' }}
          >
            {signupMutation.isPending ? 'Creating shop…' : 'Create shop'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <button onClick={onLoginClick} className="text-muted underline">
            Already have an account? Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
