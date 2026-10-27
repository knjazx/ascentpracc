import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, toSafeUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateProfileSchema } from '@/lib/validations/user';
import { signUserToken } from '@/lib/jwt';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from '@/lib/auth';
import { fetchSteamUserProfile } from '@/lib/steam';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let activeUser = user;
  if (user.nickname.startsWith('Player_')) {
    const { nickname, avatarUrl } = await fetchSteamUserProfile(
      user.steamId,
      process.env.STEAM_API_KEY
    );
    if (!nickname.startsWith('Player_')) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { nickname, avatarUrl },
      });
      activeUser = toSafeUser(updated);
    }
  }

  // Fetch unread notifications count and user's managed teams
  const [unreadNotifications, managedTeams] = await Promise.all([
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

  return NextResponse.json({
    success: true,
    data: {
      ...activeUser,
      unreadNotifications,
      teams: managedTeams.map((tm) => ({
        ...tm.team,
        isOwner: tm.isOwner,
      })),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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

    // Re-sign JWT if onboarded status changed
    const newToken = await signUserToken({
      userId: updatedUser.id,
      steamId: updatedUser.steamId,
      role: updatedUser.role,
      banned: updatedUser.banned,
      onboarded: updatedUser.onboarded,
    });

    const response = NextResponse.json({
      success: true,
      data: toSafeUser(updatedUser),
    });

    response.cookies.set(AUTH_COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
