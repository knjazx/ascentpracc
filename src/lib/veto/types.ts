import { VetoType, SideChoice, ScrimFormat } from '@prisma/client';

export type TeamRole = 'TEAM_A' | 'TEAM_B';

export interface VetoStep {
  order: number;
  teamRole: TeamRole;
  actionType: VetoType;
  targetMap?: string; // For SIDE choices (which map is having sides chosen)
}

export interface VetoActionRecord {
  id?: string;
  order: number;
  teamRole: TeamRole;
  teamId?: string | null;
  teamTag?: string;
  type: VetoType;
  map: string;
  side?: SideChoice | null;
  createdAt: string;
}

export interface PickedMapResult {
  order: number;
  map: string;
  pickedByRole?: TeamRole;
  pickedByTeamId?: string;
  startSideA?: 'CT' | 'T';
}

export interface VetoState {
  matchId: string;
  format: ScrimFormat;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED';
  coinFlipWinnerRole: TeamRole;
  coinFlipWinnerId: string;
  currentStepIndex: number;
  steps: VetoStep[];
  availableMaps: string[];
  bannedMaps: string[];
  pickedMaps: PickedMapResult[];
  actions: VetoActionRecord[];
  turnExpiresAt: number; // UTC timestamp ms
  turnDurationSec: number;
  isFinished: boolean;
  currentTurnRole: TeamRole | null;
  currentActionType: VetoType | null;
  currentTargetMap?: string;
}
