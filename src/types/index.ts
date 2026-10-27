import {
  Role,
  ScrimFormat,
  ServerBy,
  ScrimStatus,
  ResponseStatus,
  MatchStatus,
  VetoType,
  SideChoice,
  ReportTargetType,
  ReportStatus,
} from '@prisma/client';

export type {
  Role,
  ScrimFormat,
  ServerBy,
  ScrimStatus,
  ResponseStatus,
  MatchStatus,
  VetoType,
  SideChoice,
  ReportTargetType,
  ReportStatus,
};

export type PlatformType = 'CYBERSHOCK' | 'XPLAY' | 'FASTCUP' | 'OTHER';

export const PLATFORM_LABELS: Record<string, string> = {
  CYBERSHOCK: 'Cybershock',
  XPLAY: 'Xplay',
  FASTCUP: 'Fastcup',
  OTHER: 'Другой',
};

export interface SafeUser {
  id: string;
  steamId: string;
  nickname: string;
  avatarUrl: string;
  timezone: string;
  discordTag: string | null;
  role: Role;
  banned: boolean;
  onboarded: boolean;
  createdAt: string;
}

export interface UserSessionPayload {
  userId: string;
  steamId: string;
  role: Role;
  banned: boolean;
  onboarded: boolean;
}

export interface ServerConnectionInfo {
  ip: string;
  port: number;
  password?: string;
  tvPort?: number;
  connectUrl?: string;
  byTeamId?: string;
}

export interface MapStatsEntry {
  played: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface TeamStatsSummary {
  teamId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  form: string;
  mapStats: Record<string, MapStatsEntry>;
  h2h: Record<string, { wins: number; losses: number; draws: number }>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
