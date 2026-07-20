import React, { createContext, useContext, useState } from 'react';
import { logout, setDeviceToken, setToken as persistToken } from './storage';

export type Role = 'OWNER' | 'MANAGER' | 'CASHIER';

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  organizationId: string;
  organizationName: string;
  branchId: string | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  signIn: (token: string, user: SessionUser, deviceToken?: string | null) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  function signIn(token: string, newUser: SessionUser, deviceToken?: string | null) {
    persistToken(token);
    if (deviceToken) setDeviceToken(deviceToken);
    setUser(newUser);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, signIn, signOut: logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
