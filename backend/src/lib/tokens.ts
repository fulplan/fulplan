import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = "ghpos";

export type Role = "OWNER" | "MANAGER" | "CASHIER";

export interface AccessTokenPayload {
  userId: string;
  organizationId: string;
  branchId: string | null;
  role: Role;
  /** Present for cashier/device sessions so revoking the device kills the session. */
  deviceId: string | null;
}

/**
 * Cashiers stay signed in through a whole shift; owners get a shorter window
 * since their account can see profit figures and change prices.
 */
const TTL: Record<Role, string> = {
  OWNER: "12h",
  MANAGER: "12h",
  CASHIER: "24h",
};

export async function signAccessToken(
  payload: AccessTokenPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(TTL[payload.role])
    .sign(secret);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
    const { userId, organizationId, branchId, role, deviceId } =
      payload as unknown as AccessTokenPayload;

    if (!userId || !organizationId || !role) return null;

    return {
      userId,
      organizationId,
      branchId: branchId ?? null,
      role,
      deviceId: deviceId ?? null,
    };
  } catch {
    // Expired, tampered, or malformed — all mean "not authenticated".
    return null;
  }
}

/**
 * Device tokens are opaque random strings. We store only a SHA-256 hash,
 * so a database leak can't be replayed as a valid device.
 */
export function generateDeviceToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashDeviceToken(token) };
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
