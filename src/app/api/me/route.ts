import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, toSafeUser, getRequestBaseUrl } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateProfileSchema } from '@/lib/validations/user';
import { signUserToken } from '@/lib/jwt';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from '@/lib/auth';
import { memoryCache } from '@/lib/memory-cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const cacheKey = `user:me:${user.id}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: NO_CACHE_HEADERS });
    }

    const activeUser = user;

    // Safely query unread notifications count and user's managed teams
    let unreadNotifications = 0;
    let managedTeams: { team: { id: string; name: string; tag: string; logoUrl: string | null }; isOwner: boolean }[] = [];

    try {
      const [notifs, teams] = await Promise.all([
        prisma.notification.count({
          where: {
            userId: activeUser.id,
            read: false,
          },
        }),
        prisma.teamManager.findMany({
          where: { userId: activeUser.id },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                tag: true,
                logoUrl: true,
              },
            },
          },
        }),
      ]);
      unreadNotifications = notifs;
      managedTeams = teams;
    } catch (dbErr) {
      console.warn('[API /me] Could not load supplementary notifications/teams data:', dbErr);
    }

    const payload = {
      success: true,
      data: {
        ...activeUser,
        unreadNotifications,
        teams: managedTeams.map((tm) => ({
          ...tm.team,
          isOwner: tm.isOwner,
        })),
      },
    };

    memoryCache.set(cacheKey, payload, 60);

    return NextResponse.json(payload, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    console.error('[API /me] Critical error processing GET /api/me:', err);
    return NextResponse.json(
      { success: false, error: 'Server temporarily unavailable' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const validated = updateProfileSchema.parse(body);

    const updateData: { timezone?: string; discordTag?: string | null; onboarded?: boolean } = {};

    updateData.timezone = validated.timezone || 'SYSTEM';
    updateData.onboarded = true;

    if (validated.discordTag !== undefined) {
      updateData.discordTag = validated.discordTag ? validated.discordTag.trim() : null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: updateData,
    });

    memoryCache.invalidate(`user:session:${currentUser.id}`);
    memoryCache.invalidate(`user:me:${currentUser.id}`);

    // Re-sign JWT if onboarded status changed
    const newToken = await signUserToken({
      userId: updatedUser.id,
      steamId: updatedUser.steamId,
      role: updatedUser.role,
      banned: updatedUser.banned,
      onboarded: updatedUser.onboarded,
    });

    const response = NextResponse.json(
      {
        success: true,
        data: toSafeUser(updatedUser),
      },
      { headers: NO_CACHE_HEADERS }
    );

    const baseUrl = getRequestBaseUrl(request);
    const isHttps = baseUrl.startsWith('https://');

    response.cookies.set(AUTH_COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid request payload';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
