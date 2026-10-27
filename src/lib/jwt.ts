import { SignJWT, jwtVerify } from 'jose';
import { UserSessionPayload } from '@/types';

export const DEFAULT_JWT_SECRET = 'super_secret_jwt_key_cs2_scrim_league_at_least_32_chars_long';
export const JWT_EXPIRATION_TIME = '30d';

export function getJwtKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  return new TextEncoder().encode(secret);
}

export async function signUserToken(payload: UserSessionPayload): Promise<string> {
  const key = getJwtKey();
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION_TIME)
    .sign(key);
}

export async function verifyUserToken(token: string): Promise<UserSessionPayload | null> {
  const primaryKey = getJwtKey();

  // 1. Attempt verification with current/primary secret
  try {
    const { payload } = await jwtVerify(token, primaryKey, {
      algorithms: ['HS256'],
    });

    return {
      userId: payload.userId as string,
      steamId: payload.steamId as string,
      role: payload.role as UserSessionPayload['role'],
      banned: Boolean(payload.banned),
      onboarded: Boolean(payload.onboarded),
    };
  } catch {
    // 2. If primary verification failed and a custom secret is set, try default fallback
    // to prevent invalidating user sessions if environment variables differed across deploys
    if (process.env.JWT_SECRET && process.env.JWT_SECRET !== DEFAULT_JWT_SECRET) {
      try {
        const fallbackKey = new TextEncoder().encode(DEFAULT_JWT_SECRET);
        const { payload } = await jwtVerify(token, fallbackKey, {
          algorithms: ['HS256'],
        });

        return {
          userId: payload.userId as string,
          steamId: payload.steamId as string,
          role: payload.role as UserSessionPayload['role'],
          banned: Boolean(payload.banned),
          onboarded: Boolean(payload.onboarded),
        };
      } catch {
        // Fallback also failed, token is invalid or expired
      }
    }

    return null;
  }
}
