const PREFIX = 'ghpos:';

export const STORAGE_KEYS = {
  token: `${PREFIX}token`,
  deviceToken: `${PREFIX}device-token`,
} as const;

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.token);
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.token, token);
}

export function getDeviceToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.deviceToken);
}

export function setDeviceToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.deviceToken, token);
}

/**
 * Regular logout — clears the auth JWT but keeps the device token so the PIN
 * screen still works for the next cashier on this same device.
 * Full page reload clears all React state and TanStack Query cache.
 */
export function logout(): void {
  localStorage.removeItem(STORAGE_KEYS.token);
  window.location.reload();
}

/**
 * Hard reset — clears everything including the device token, then reloads.
 * Used on organisation switch and security events (e.g. revoked device).
 * Prevents any in-memory state leaking across shops on a shared tablet.
 */
export function hardReset(): void {
  localStorage.clear();
  window.location.reload();
}
