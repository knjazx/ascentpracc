import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from './auth';
import {
  startVeto,
  processVetoAction,
  processVetoTimeout,
  getVetoState,
} from '@/lib/veto/state-machine';
import { SideChoice } from '@prisma/client';

// In-memory timers for active match veto steps
const activeVetoTimers = new Map<string, NodeJS.Timeout>();

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

        if (!updatedState.isFinished) {
          scheduleStepTimer(matchId);
        } else {
          activeVetoTimers.delete(matchId);
          io.to(`match:${matchId}`).emit('veto_finished', updatedState);
        }
      } catch (err) {
        console.error('[Veto Timer] Error processing auto-timeout:', err);
      }
    }, 60 * 1000);

    activeVetoTimers.set(matchId, timer);
  }

  // 1. Start Veto (Coinflip & initiation)
  socket.on(
    'start_veto',
    async (matchId: string, callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        const state = await startVeto(matchId);

        io.to(`match:${matchId}`).emit('veto_started', state);
        io.to(`match:${matchId}`).emit('new_message', {
          id: `sys-coin-${Date.now()}`,
          matchId,
          system: true,
          text: `Монетка брошена! Первый ход делает ${
            state.coinFlipWinnerRole === 'TEAM_A' ? 'команда организатора' : 'команда соперника'
          }. Время на ход: 60 сек.`,
          createdAt: new Date().toISOString(),
        });

        scheduleStepTimer(matchId);
        callback?.({ success: true });
      } catch (err: unknown) {
        console.error('[Veto Socket] Error starting veto:', err);
        callback?.({ success: false, error: err instanceof Error ? err.message : 'Ошибка запуска вето' });
      }
    }
  );

  // 2. Perform Veto Action (Ban / Pick / Side)
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
