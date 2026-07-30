import { useEffect, useState } from 'react';
import { useAuth } from './lib/auth-context';
import { getDeviceToken, getToken, STORAGE_KEYS } from './lib/storage';
import { trpc } from './lib/trpc';
import { Dashboard } from './pages/Dashboard';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { PinScreen } from './pages/PinScreen';
import { SignupPage } from './pages/SignupPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import type { SessionUser } from './lib/auth-context';

type Screen = 'loading' | 'landing' | 'login' | 'signup' | 'pin' | 'dashboard' | 'superadmin';

// Referral code from ?ref= URL param — captured once on load.
const urlRef = new URLSearchParams(window.location.search).get('ref') ?? '';

function initialScreen(): Screen {
  if (getToken()) return 'loading'; // we have a token, verify it
  if (getDeviceToken()) return 'pin'; // registered device, show cashier screen
  return 'landing'; // first-time visitor — show marketing page
}

export function App() {
  const { setUser, signIn } = useAuth();
  const [screen, setScreen] = useState<Screen>(initialScreen);

  // Verify a stored JWT on load. Skipped when there's no token.
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: screen === 'loading',
    retry: false,
  });

  useEffect(() => {
    if (screen !== 'loading') return;
    if (meQuery.data) {
      const me = meQuery.data;
      setUser({
        id: me.id,
        name: me.name,
        role: me.role,
        organizationId: me.organization.id,
        organizationName: me.organization.name,
        branchId: me.branchId,
      });
      setScreen('dashboard');
    } else if (meQuery.isError) {
      // Token invalid or expired — drop it, then decide next screen
      localStorage.removeItem(STORAGE_KEYS.token);
      setScreen(getDeviceToken() ? 'pin' : 'login');
    }
  }, [meQuery.data, meQuery.isError, screen, setUser]);

  function handleSignedIn(token: string, user: SessionUser, deviceToken?: string | null) {
    signIn(token, user, deviceToken);
    setScreen('dashboard');
  }

  if (screen === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (screen === 'landing') {
    return (
      <LandingPage
        onSignup={() => setScreen('signup')}
        onLogin={() => setScreen('login')}
        referralCode={urlRef}
      />
    );
  }

  if (screen === 'signup') {
    return (
      <SignupPage
        onSignedUp={(token, user) => handleSignedIn(token, user)}
        onLoginClick={() => setScreen('login')}
        initialReferralCode={urlRef}
      />
    );
  }

  if (screen === 'pin') {
    return (
      <PinScreen
        onSignedIn={handleSignedIn}
        onOwnerLoginClick={() => setScreen('login')}
      />
    );
  }

  if (screen === 'dashboard') {
    return <Dashboard onEnterAdmin={() => setScreen('superadmin')} />;
  }

  if (screen === 'superadmin') {
    return <SuperAdminPage onBack={() => setScreen('dashboard')} />;
  }

  // 'login' (default)
  return (
    <LoginPage
      onSignedIn={handleSignedIn}
      onSignupClick={() => setScreen('signup')}
      onPinClick={getDeviceToken() ? () => setScreen('pin') : undefined}
    />
  );
}
