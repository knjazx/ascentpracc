import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { verifyUserToken } from '@/lib/jwt';
import { SafeUser } from '@/types';
import { User, Role } from '@prisma/client';

export const AUTH_COOKIE_NAME = 'cs2_session';
export const NONCE_COOKIE_NAME = 'cs2_steam_nonce';
export const AUTH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
export const NONCE_COOKIE_MAX_AGE = 10 * 60; // 10 minutes in seconds

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    steamId: user.steamId,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    discordTag: user.discordTag,
    role: user.role,
    banned: user.banned,
    onboarded: user.onboarded,
    createdAt: user.createdAt.toISOString(),
  };
}

export function isSteamIdAdmin(steamId: string): boolean {
  const envAdminIds = process.env.ADMIN_STEAM_IDS || '';
  const adminIds = envAdminIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return adminIds.includes(steamId);
}

export function sanitizeNextUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) return '/';
  // Disallow absolute URLs, protocol relative URLs (//evil.com), or javascript: schemes
  if (!rawUrl.startsWith('/') || rawUrl.startsWith('//') || rawUrl.includes('\\')) {
    return '/';
  }
  return rawUrl;
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const payload = await verifyUserToken(token);
    if (!payload || !payload.userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return null;
    }

    // Always keep admin status synchronized with environment configuration
    if (isSteamIdAdmin(user.steamId) && user.role !== Role.ADMIN) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role: Role.ADMIN },
      });
      return toSafeUser(updated);
    }

    return toSafeUser(user);
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}
