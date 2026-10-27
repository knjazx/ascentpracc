import { Socket } from 'socket.io';
import { verifyUserToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { SafeUser } from '@/types';
import { toSafeUser, AUTH_COOKIE_NAME } from '@/lib/auth';

function parseCookie(cookieHeader: string | undefined): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    const value = decodeURI(parts.join('='));
    if (name) list[name] = value;
  });

  return list;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: SafeUser;
  };
}

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
) {
  try {
    const cookieHeader = socket.request.headers.cookie;
    const cookies = parseCookie(cookieHeader);
    const token = cookies[AUTH_COOKIE_NAME];

    if (!token) {
      return next(new Error('Unauthorized: No session cookie provided'));
    }

    const payload = await verifyUserToken(token);
    if (!payload || (!payload.userId && !payload.steamId)) {
      return next(new Error('Unauthorized: Invalid or expired token'));
    }

    let user = payload.userId
      ? await prisma.user.findUnique({
          where: { id: payload.userId },
        })
      : null;

    if (!user && payload.steamId) {
      user = await prisma.user.findUnique({
        where: { steamId: payload.steamId },
      });
    }

    if (!user) {
      return next(new Error('Unauthorized: User not found'));
    }

    if (user.banned) {
      return next(new Error('Forbidden: User account is banned'));
    }

    socket.data.user = toSafeUser(user);
    next();
  } catch (err) {
    console.error('[Socket Auth] Verification error:', err);
    next(new Error('Internal server error during socket authentication'));
  }
}
