import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from './auth';
import prisma from '@/lib/prisma';
import { sanitizeChatMessage } from '@/lib/sanitize';
import { rateLimit } from '@/lib/rate-limit';
import { Role } from '@prisma/client';

export function registerMatchHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  const user = socket.data.user;
  if (!user) return;

  // 1. Join Match Lobby
  socket.on('join_match', async (matchId: string, callback?: (res: { success: boolean; error?: string }) => void) => {
    try {
      if (!matchId) {
        callback?.({ success: false, error: 'ID матча не указан' });
        return;
      }

      // Verify user has access to this match (Team A manager, Team B manager, or ADMIN)
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          teamA: { include: { managers: true } },
          teamB: { include: { managers: true } },
        },
      });

      if (!match) {
        callback?.({ success: false, error: 'Матч не найден' });
        return;
      }

      const isManagerA = match.teamA.managers.some((m) => m.userId === user.id);
      const isManagerB = match.teamB.managers.some((m) => m.userId === user.id);
      const isAdmin = user.role === Role.ADMIN;

      if (!isManagerA && !isManagerB && !isAdmin) {
        callback?.({ success: false, error: 'Доступ в лобби разрешен только капитанам команд и судьям' });
        return;
      }

      const room = `match:${matchId}`;
      socket.join(room);

      // System notification about user joining
      io.to(room).emit('user_joined', {
        userId: user.id,
        nickname: user.nickname,
        teamTag: isManagerA ? match.teamA.tag : isManagerB ? match.teamB.tag : 'ADMIN',
      });

      callback?.({ success: true });
    } catch (err) {
      console.error('[Socket Match] Error joining match:', err);
      callback?.({ success: false, error: 'Ошибка при подключении к лобби' });
    }
  });

  // 2. Chat Message
  socket.on(
    'send_message',
    async (
      data: { matchId: string; text: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const { matchId, text } = data;
        if (!matchId || !text) return;

        // Anti-spam rate limiting: max 2 messages per 2 seconds
        const { success: allowed } = await rateLimit(`chat:${user.id}:${matchId}`, 2, 2);
        if (!allowed) {
          callback?.({ success: false, error: 'Слишком частые сообщения (антиспам)' });
          return;
        }

        const sanitizedText = sanitizeChatMessage(text);
        if (sanitizedText.length === 0) {
          callback?.({ success: false, error: 'Сообщение не может быть пустым' });
          return;
        }

        const match = await prisma.match.findUnique({
          where: { id: matchId },
          include: {
            teamA: { include: { managers: true } },
            teamB: { include: { managers: true } },
          },
        });

        if (!match) return;

        const isManagerA = match.teamA.managers.some((m) => m.userId === user.id);
        const isManagerB = match.teamB.managers.some((m) => m.userId === user.id);
        const isAdmin = user.role === Role.ADMIN;

        if (!isManagerA && !isManagerB && !isAdmin) {
          callback?.({ success: false, error: 'Нет прав на отправку сообщений' });
          return;
        }

        const teamId = isManagerA ? match.teamAId : isManagerB ? match.teamBId : null;
        const teamTag = isManagerA ? match.teamA.tag : isManagerB ? match.teamB.tag : 'ADMIN';

        const savedMessage = await prisma.chatMessage.create({
          data: {
            matchId,
            userId: user.id,
            teamId,
            system: false,
            text: sanitizedText,
          },
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                avatarUrl: true,
              },
            },
          },
        });

        const messagePayload = {
          id: savedMessage.id,
          matchId,
          userId: user.id,
          teamId,
          teamTag,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          text: savedMessage.text,
          system: false,
          createdAt: savedMessage.createdAt.toISOString(),
        };

        io.to(`match:${matchId}`).emit('new_message', messagePayload);
        callback?.({ success: true });
      } catch (err) {
        console.error('[Socket Chat] Error sending message:', err);
        callback?.({ success: false, error: 'Ошибка отправки сообщения' });
      }
    }
  );

  // 3. Update Server Info
  socket.on(
    'update_server_info',
    async (
      data: {
        matchId: string;
        serverInfo: {
          ip: string;
          port: number;
          password?: string;
          tvPort?: number;
        };
      },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const { matchId, serverInfo } = data;
        const match = await prisma.match.findUnique({
          where: { id: matchId },
          include: {
            request: true,
            teamA: { include: { managers: true } },
            teamB: { include: { managers: true } },
          },
        });

        if (!match) {
          callback?.({ success: false, error: 'Матч не найден' });
          return;
        }

        const isManagerA = match.teamA.managers.some((m) => m.userId === user.id);
        const isManagerB = match.teamB.managers.some((m) => m.userId === user.id);
        const isAdmin = user.role === Role.ADMIN;

        if (!isManagerA && !isManagerB && !isAdmin) {
          callback?.({ success: false, error: 'Недостаточно прав' });
          return;
        }

        const authorTeamTag = isManagerA ? match.teamA.tag : isManagerB ? match.teamB.tag : 'Судья';
        const connectUrl = `steam://connect/${serverInfo.ip}:${serverInfo.port}${
          serverInfo.password ? '/' + serverInfo.password : ''
        }`;

        const payload = {
          ...serverInfo,
          connectUrl,
          byTeamId: isManagerA ? match.teamAId : match.teamBId,
        };

        await prisma.$transaction(async (tx) => {
          await tx.match.update({
            where: { id: matchId },
            data: { serverInfo: payload },
          });

          await tx.chatMessage.create({
            data: {
              matchId,
              system: true,
              text: `Команда [${authorTeamTag}] обновила параметры сервера: ${serverInfo.ip}:${serverInfo.port}`,
            },
          });
        });

        io.to(`match:${matchId}`).emit('server_info_updated', payload);
        io.to(`match:${matchId}`).emit('new_message', {
          id: `sys-${Date.now()}`,
          matchId,
          system: true,
          text: `Команда [${authorTeamTag}] обновила параметры сервера: ${serverInfo.ip}:${serverInfo.port}`,
          createdAt: new Date().toISOString(),
        });

        callback?.({ success: true });
      } catch (err) {
        console.error('[Socket ServerInfo] Error updating server:', err);
        callback?.({ success: false, error: 'Не удалось обновить серверные данные' });
      }
    }
  );

  // 4. Leave Match
  socket.on('leave_match', (matchId: string) => {
    if (matchId) {
      socket.leave(`match:${matchId}`);
    }
  });
}
