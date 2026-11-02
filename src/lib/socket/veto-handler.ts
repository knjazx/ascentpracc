import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from './auth';
import prisma from '@/lib/prisma';
import {
  startVeto,
  processVetoAction,
  processVetoTimeout,
  getVetoState,
} from '@/lib/veto/state-machine';
import { SideChoice } from '@prisma/client';

// In-memory timers for active match veto steps (30 seconds per turn)
const activeVetoTimers = new Map<string, NodeJS.Timeout>();

// In-memory active ready checks before veto start (10 seconds countdown)
interface VetoReadyCheck {
  matchId: string;
  requestedByUserId: string;
  requestedByUserName: string;
  requestedByRole: 'TEAM_A' | 'TEAM_B';
  requestedByTeamTag: string;
  targetRole: 'TEAM_A' | 'TEAM_B';
  targetTeamTag: string;
  expiresAt: number;
  timeoutTimer: NodeJS.Timeout;
}
const activeReadyChecks = new Map<string, VetoReadyCheck>();

export function registerVetoHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  const user = socket.data.user;
  if (!user) return;

  function scheduleStepTimer(matchId: string) {
    // Clear existing timer if any
    const existing = activeVetoTimers.get(matchId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      try {
        console.log(`[Veto Timer] Turn timeout expired for match ${matchId}. Auto-action...`);
        const updatedState = await processVetoTimeout(matchId);
        io.to(`match:${matchId}`).emit('veto_state_updated', updatedState);

        // Broadcast any newly created system chat messages
        const recentMessages = await prisma.chatMessage.findMany({
          where: {
            matchId,
            system: true,
            createdAt: { gte: new Date(Date.now() - 3500) },
          },
          orderBy: { createdAt: 'asc' },
        });
        for (const msg of recentMessages) {
          io.to(`match:${matchId}`).emit('new_message', {
            id: msg.id,
            matchId: msg.matchId,
            system: true,
            text: msg.text,
            createdAt: msg.createdAt.toISOString(),
          });
        }

        if (!updatedState.isFinished) {
          scheduleStepTimer(matchId);
        } else {
          activeVetoTimers.delete(matchId);
          io.to(`match:${matchId}`).emit('veto_finished', updatedState);
        }
      } catch (err) {
        console.error('[Veto Timer] Error processing auto-timeout:', err);
      }
    }, 30 * 1000);

    activeVetoTimers.set(matchId, timer);
  }

  // 1. Request Veto Start (Sends 10s confirmation to the other team)
  socket.on(
    'start_veto',
    async (matchId: string, callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
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
        const isAdmin = user.role === 'ADMIN';

        if (!isManagerA && !isManagerB && !isAdmin) {
          callback?.({ success: false, error: 'Только капитаны команд или администратор могут начать вето' });
          return;
        }

        // Check if ready check is already running
        if (activeReadyChecks.has(matchId)) {
          callback?.({ success: false, error: 'Подтверждение готовности уже отправлено сопернику' });
          return;
        }

        // If admin starts veto, bypass ready check and start immediately
        if (isAdmin && !isManagerA && !isManagerB) {
          const state = await startVeto(matchId);
          io.to(`match:${matchId}`).emit('veto_started', state);
          io.to(`match:${matchId}`).emit('new_message', {
            id: `sys-coin-${Date.now()}`,
            matchId,
            system: true,
            text: `👑 Администратор запустил вето карт! Монетка брошена. Первый ход: ${
              state.coinFlipWinnerRole === 'TEAM_A' ? `[${match.teamA.tag}]` : `[${match.teamB.tag}]`
            }. Время на ход: 30 сек.`,
            createdAt: new Date().toISOString(),
          });
          scheduleStepTimer(matchId);
          callback?.({ success: true });
          return;
        }

        // Team-initiated: Send 10-second confirmation to the other team
        const requestedByRole: 'TEAM_A' | 'TEAM_B' = isManagerA ? 'TEAM_A' : 'TEAM_B';
        const targetRole: 'TEAM_A' | 'TEAM_B' = isManagerA ? 'TEAM_B' : 'TEAM_A';
        const requestedByTeamTag = isManagerA ? match.teamA.tag : match.teamB.tag;
        const targetTeamTag = isManagerA ? match.teamB.tag : match.teamA.tag;
        const expiresAt = Date.now() + 10 * 1000;

        const timeoutTimer = setTimeout(() => {
          activeReadyChecks.delete(matchId);
          io.to(`match:${matchId}`).emit('veto_ready_timeout', { matchId });
          io.to(`match:${matchId}`).emit('new_message', {
            id: `sys-ready-timeout-${Date.now()}`,
            matchId,
            system: true,
            text: `⏳ Время на подтверждение готовности к вето (10 сек) истекло. Вето не начато.`,
            createdAt: new Date().toISOString(),
          });
        }, 10 * 1000);

        activeReadyChecks.set(matchId, {
          matchId,
          requestedByUserId: user.id,
          requestedByUserName: user.nickname,
          requestedByRole,
          requestedByTeamTag,
          targetRole,
          targetTeamTag,
          expiresAt,
          timeoutTimer,
        });

        io.to(`match:${matchId}`).emit('veto_ready_requested', {
          matchId,
          requestedByRole,
          requestedByUserName: user.nickname,
          requestedByTeamTag,
          targetRole,
          targetTeamTag,
          expiresAt,
        });

        io.to(`match:${matchId}`).emit('new_message', {
          id: `sys-ready-req-${Date.now()}`,
          matchId,
          system: true,
          text: `⚡ [${requestedByTeamTag}] ${user.nickname} запросил старт вето! У команды [${targetTeamTag}] есть 10 секунд на подтверждение.`,
          createdAt: new Date().toISOString(),
        });

        callback?.({ success: true });
      } catch (err: unknown) {
        console.error('[Veto Socket] Error starting veto:', err);
        callback?.({ success: false, error: err instanceof Error ? err.message : 'Ошибка запуска вето' });
      }
    }
  );

  // 2. Accept Veto Ready Check (Target team accepts within 10s)
  socket.on(
    'accept_veto_ready',
    async (matchId: string, callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        const readyCheck = activeReadyChecks.get(matchId);
        if (!readyCheck) {
          callback?.({ success: false, error: 'Время подтверждения истекло' });
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

        const isTargetA = readyCheck.targetRole === 'TEAM_A' && match.teamA.managers.some((m) => m.userId === user.id);
        const isTargetB = readyCheck.targetRole === 'TEAM_B' && match.teamB.managers.some((m) => m.userId === user.id);
        const isAdmin = user.role === 'ADMIN';

        if (!isTargetA && !isTargetB && !isAdmin) {
          callback?.({ success: false, error: 'Только капитан команды соперника может подтвердить готовность' });
          return;
        }

        clearTimeout(readyCheck.timeoutTimer);
        activeReadyChecks.delete(matchId);

        const state = await startVeto(matchId);
        io.to(`match:${matchId}`).emit('veto_started', state);
        io.to(`match:${matchId}`).emit('new_message', {
          id: `sys-coin-${Date.now()}`,
          matchId,
          system: true,
          text: `✅ Готовность подтверждена! Монетка брошена. Первый ход делает ${
            state.coinFlipWinnerRole === 'TEAM_A' ? `команда [${match.teamA.tag}]` : `команда [${match.teamB.tag}]`
          }. Время на ход: 30 сек.`,
          createdAt: new Date().toISOString(),
        });

        scheduleStepTimer(matchId);
        callback?.({ success: true });
      } catch (err: unknown) {
        console.error('[Veto Socket] Error accepting ready check:', err);
        callback?.({ success: false, error: err instanceof Error ? err.message : 'Ошибка подтверждения готовности' });
      }
    }
  );

  // 3. Decline Veto Ready Check
  socket.on(
    'decline_veto_ready',
    async (matchId: string, callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        const readyCheck = activeReadyChecks.get(matchId);
        if (!readyCheck) {
          callback?.({ success: false });
          return;
        }

        clearTimeout(readyCheck.timeoutTimer);
        activeReadyChecks.delete(matchId);

        io.to(`match:${matchId}`).emit('veto_ready_declined', { matchId });
        io.to(`match:${matchId}`).emit('new_message', {
          id: `sys-ready-declined-${Date.now()}`,
          matchId,
          system: true,
          text: `❌ Команда [${readyCheck.targetTeamTag}] отклонила подтверждение готовности к вето.`,
          createdAt: new Date().toISOString(),
        });

        callback?.({ success: true });
      } catch (err) {
        console.error('[Veto Socket] Error declining ready check:', err);
      }
    }
  );

  // 4. Perform Veto Action (Ban / Pick / Side)
  socket.on(
    'veto_action',
    async (
      data: { matchId: string; map?: string; side?: SideChoice },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const { matchId, map, side } = data;
        const updatedState = await processVetoAction(matchId, user.id, { map, side });

        io.to(`match:${matchId}`).emit('veto_state_updated', updatedState);

        // Broadcast newly created system chat messages for the veto action
        const recentMessages = await prisma.chatMessage.findMany({
          where: {
            matchId,
            system: true,
            createdAt: { gte: new Date(Date.now() - 3500) },
          },
          orderBy: { createdAt: 'asc' },
        });
        for (const msg of recentMessages) {
          io.to(`match:${matchId}`).emit('new_message', {
            id: msg.id,
            matchId: msg.matchId,
            system: true,
            text: msg.text,
            createdAt: msg.createdAt.toISOString(),
          });
        }

        if (updatedState.isFinished) {
          const existing = activeVetoTimers.get(matchId);
          if (existing) clearTimeout(existing);
          activeVetoTimers.delete(matchId);

          io.to(`match:${matchId}`).emit('veto_finished', updatedState);
        } else {
          scheduleStepTimer(matchId);
        }

        callback?.({ success: true });
      } catch (err: unknown) {
        console.error('[Veto Socket] Action error:', err);
        callback?.({ success: false, error: err instanceof Error ? err.message : 'Ошибка действия вето' });
      }
    }
  );
}
