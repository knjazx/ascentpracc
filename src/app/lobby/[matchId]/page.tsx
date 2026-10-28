'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { useSocket } from '@/hooks/useSocket';
import { MatchHeader } from '@/components/lobby/MatchHeader';
import { ServerInfoCard, ServerInfoData } from '@/components/lobby/ServerInfoCard';
import { LobbyChat, ChatMsg } from '@/components/lobby/LobbyChat';
import { RescheduleModal } from '@/components/lobby/RescheduleModal';
import { VetoBoard } from '@/components/veto/VetoBoard';
import { ScoreSubmissionCard } from '@/components/lobby/ScoreSubmissionCard';
import { PostMatchReview } from '@/components/lobby/PostMatchReview';
import { VetoState } from '@/lib/veto/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Ban, ArrowLeft, ShieldAlert, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface MatchLobbyData {
  id: string;
  format: 'BO1' | 'BO2' | 'BO3';
  platform?: string;
  status: string;
  scheduledAt: string;
  winnerId: string | null;
  serverInfo: ServerInfoData | null;
  userTeamRole: 'TEAM_A' | 'TEAM_B' | 'ADMIN';
  teamAId: string;
  teamBId: string;
  teamA: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
  };
  teamB: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
  };
  request?: {
    serverBy: 'HOST' | 'GUEST' | 'NEGOTIABLE';
  } | null;
  chatMessages: ChatMsg[];
  vetoState?: VetoState | null;
  maps: Array<{
    id: string;
    order: number;
    map: string;
    pickedBy?: string | null;
    scoreA_byA?: number | null;
    scoreB_byA?: number | null;
    scoreA_byB?: number | null;
    scoreB_byB?: number | null;
    finalScoreA?: number | null;
    finalScoreB?: number | null;
  }>;
  rescheduleRequests: Array<{
    id: string;
    byTeamId: string;
    proposedAt: string;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
    byTeam?: { tag: string; name: string };
  }>;
}

export default function MatchLobbyPage() {
  const { matchId } = useParams() as { matchId: string };
  const router = useRouter();
  const { user } = useUser();
  const { socket, isConnected } = useSocket();

  const [match, setMatch] = useState<MatchLobbyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchMatch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/matches/${matchId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка загрузки лобби матча');
      }
      setMatch(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить лобби');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  // Join match socket room on connect
  useEffect(() => {
    if (!socket || !isConnected || !matchId) return;

    socket.emit('join_match', matchId, (res: { success: boolean; error?: string }) => {
      if (!res.success) {
        console.warn('[Socket Lobby] Join error:', res.error);
      }
    });

    return () => {
      socket.emit('leave_match', matchId);
    };
  }, [socket, isConnected, matchId]);

  const handleCancelMatch = async () => {
    if (!confirm('Запросить отмену матча? (Для отмены требуется подтверждение соперника)')) return;
    setCancelling(true);

    try {
      const res = await fetch(`/api/matches/${matchId}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при запросе отмены');
      }
      alert(data.message);
      await fetchMatch();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-16 text-center text-muted-foreground animate-pulse">
        Подключение к лобби матча...
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="container py-16 text-center space-y-4 max-w-md">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Доступ ограничен</h2>
        <p className="text-sm text-muted-foreground">
          {error || 'Вы не являетесь участником этого матча.'}
        </p>
        <Link href="/">
          <Button variant="outline">Вернуться на главную</Button>
        </Link>
      </div>
    );
  }

  // Check if current user's team can edit server
  const serverBy = match.request?.serverBy || 'NEGOTIABLE';
  const isHost = match.userTeamRole === 'TEAM_A';
  const isGuest = match.userTeamRole === 'TEAM_B';
  const isAdmin = match.userTeamRole === 'ADMIN';

  const canEditServer =
    isAdmin ||
    (serverBy === 'HOST' && isHost) ||
    (serverBy === 'GUEST' && isGuest) ||
    serverBy === 'NEGOTIABLE';

  const userTeamId = isHost ? match.teamAId : isGuest ? match.teamBId : null;
  const userTimezone = user?.timezone || 'Europe/Kyiv';

  return (
    <div className="container py-6 space-y-6">
      {/* Top navigation link */}
      <div className="flex items-center justify-between text-xs font-mono">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>К списку праков</span>
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-white animate-pulse' : 'bg-neutral-600'
            }`}
          />
          <span className="text-muted-foreground">
            {isConnected ? 'Лобби онлайн' : 'Переподключение к сокету...'}
          </span>
        </div>
      </div>

      {/* Match Header with live countdown */}
      <MatchHeader
        format={match.format}
        platform={match.platform}
        status={match.status}
        scheduledAt={match.scheduledAt}
        teamA={match.teamA}
        teamB={match.teamB}
        userTimezone={userTimezone}
      />

      {/* Reschedule Banner / Action */}
      <RescheduleModal
        matchId={match.id}
        activeRequest={match.rescheduleRequests[0] || null}
        userTeamId={userTeamId}
        userTimezone={userTimezone}
        onRefresh={fetchMatch}
      />

      {/* Lobby Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Server Info + Veto Preview */}
        <div className="lg:col-span-2 space-y-6">
          <ServerInfoCard
            matchId={match.id}
            serverInfo={match.serverInfo}
            canEdit={canEditServer}
            socket={socket}
          />

          {/* Interactive CS2 Veto Board */}
          <VetoBoard
            matchId={match.id}
            initialState={match.vetoState || null}
            userTeamRole={match.userTeamRole}
            teamA={match.teamA}
            teamB={match.teamB}
            socket={socket}
          />

          {/* CS2 Match Score Submission Card */}
          <ScoreSubmissionCard
            matchId={match.id}
            maps={match.maps || []}
            userTeamRole={match.userTeamRole}
            teamA={match.teamA}
            teamB={match.teamB}
            status={match.status}
            onScoreSubmitted={fetchMatch}
          />

          {/* Post-Match Review, Rematch, ICS Export & No-Show Emergency */}
          <PostMatchReview
            matchId={match.id}
            status={match.status}
            scheduledAt={match.scheduledAt}
            userTeamRole={match.userTeamRole}
            teamA={match.teamA}
            teamB={match.teamB}
            onRefresh={fetchMatch}
          />

          {/* Mutual Cancellation Action - Full Width Block */}
          <div className="pt-1">
            <Button
              variant="outline"
              disabled={cancelling || match.status === 'CANCELLED'}
              onClick={handleCancelMatch}
              className="w-full h-12 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider text-rose-400 bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/30 hover:border-rose-500/60 shadow-lg transition-all gap-2"
            >
              {cancelling ? (
                <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
              ) : (
                <Ban className="w-4 h-4 text-rose-400" />
              )}
              <span>
                {match.status === 'CANCELLED'
                  ? 'Матч отменен'
                  : cancelling
                  ? 'Отмена матча...'
                  : 'Запросить отмену матча'}
              </span>
            </Button>
          </div>
        </div>

        {/* Right Column (1 col): Real-Time Lobby Chat */}
        <div className="lg:col-span-1">
          <LobbyChat
            matchId={match.id}
            initialMessages={match.chatMessages}
            socket={socket}
          />
        </div>
      </div>
    </div>
  );
}
