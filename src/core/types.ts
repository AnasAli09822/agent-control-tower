export type AgentState =
  | "idle"
  | "queued"
  | "running"
  | "waiting_approval"
  | "paused"
  | "blocked"
  | "completed"
  | "failed"
  | "killed";

export type RiskDecision = "allow" | "require_approval" | "block";

export interface RiskInput {
  toolName: string;
  environment: "sandbox" | "production";
  financialImpactUsd?: number;
  affectedRecords?: number;
  reversible: boolean;
  evidenceFreshnessMinutes?: number;
  driftScore: number;
  retryCount: number;
  inTaskScope: boolean;
}

export interface RiskResult {
  score: number;
  decision: RiskDecision;
  reasons: string[];
}

export interface DriftSignals {
  outOfScopeAttempts: number;
  repeatedNoImprovement: number;
  retryLoopCount: number;
  costRatio: number;
  tokenRatio: number;
  staleEvidence: boolean;
  goalContradictions: number;
  rejectedActions: number;
  consecutiveHighRiskActions: number;
}

export interface DriftResult {
  score: number;
  band: "normal" | "watch" | "warning" | "critical";
  autoPause: boolean;
  evidence: string[];
}
