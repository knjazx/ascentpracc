import { cache } from 'react';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyUserToken } from '@/lib/jwt';
import { SafeUser } from '@/types';
import { User, Role } from '@prisma/client';

export const AUTH_COOKIE_NAME = 'cs2_session';
export const NONCE_COOKIE_NAME = 'cs2_steam_nonce';
export const AUTH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
export const NONCE_COOKIE_MAX_AGE = 10 * 60; // 10 minutes in seconds

export function getRequestBaseUrl(request: NextRequest): string {
  // 1. Check proxy forwarding headers (Render, Vercel, Cloudflare, etc.)
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost && !forwardedHost.includes('0.0.0.0')) {
    const proto = (forwardedProto || 'https').split(',')[0].trim();
    return `${proto}://${forwardedHost.split(',')[0].trim()}`;
  }

  // 2. Check Host header (ignore 0.0.0.0 as it's an internal bind interface, not a public host)
  const host = request.headers.get('host');
  if (host && !host.includes('0.0.0.0')) {
    const proto = forwardedProto || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(':', '') : 'http');
    return `${proto}://${host}`;
  }

  // 3. Check environment variable NEXT_PUBLIC_APP_URL
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('0.0.0.0')) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 4. Fallback to nextUrl origin if not 0.0.0.0
  if (request.nextUrl.origin && request.nextUrl.origin !== 'null' && !request.nextUrl.origin.includes('0.0.0.0')) {
    return request.nextUrl.origin;
  }

  return 'http://localhost:3000';
}

export function createSafeRedirectUrl(pathnameAndQuery: string, request: NextRequest): URL {
  const baseUrl = getRequestBaseUrl(request);
  return new URL(pathnameAndQuery, baseUrl);
}

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

export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const payload = await verifyUserToken(token);
    if (!payload || (!payload.userId && !payload.steamId)) {
      return null;
    }

    let user: User | null = null;
    let attempts = 0;

    // Retry loop with short backoff to seamlessly handle database cold start / Neon wake up
    while (attempts < 2) {
      try {
        attempts++;
        if (payload.userId) {
          user = await prisma.user.findUnique({
            where: { id: payload.userId },
          });
        }

        // Fallback: If not found by CUID (e.g. database re-seeded or id mismatched),
        // look up by permanent immutable SteamID
        if (!user && payload.steamId) {
          user = await prisma.user.findUnique({
            where: { steamId: payload.steamId },
          });
        }
        break;
      } catch (dbError) {
        console.warn(`[getCurrentUser] Database query attempt ${attempts} failed:`, dbError);
        if (attempts >= 2) {
          throw dbError;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    }

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
});
