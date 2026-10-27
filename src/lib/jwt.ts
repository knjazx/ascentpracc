import { SignJWT, jwtVerify } from 'jose';
import { UserSessionPayload } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_cs2_scrim_league_at_least_32_chars_long';
const key = new TextEncoder().encode(JWT_SECRET);

export const JWT_EXPIRATION_TIME = '30d';

export async function signUserToken(payload: UserSessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION_TIME)
    .sign(key);
}

export async function verifyUserToken(token: string): Promise<UserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
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
    return null;
  }
}
