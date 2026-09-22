import type { DriftResult, DriftSignals } from "./types.ts";

export function scoreDrift(s: DriftSignals): DriftResult {
  const evidence: string[] = [];
  let score = 0;

  const add = (condition: boolean, points: number, reason: string) => {
    if (condition) { score += points; evidence.push(reason); }
  };

  add(s.outOfScopeAttempts > 0, Math.min(30, s.outOfScopeAttempts * 15), "out_of_scope_attempts");
  add(s.repeatedNoImprovement > 0, Math.min(25, s.repeatedNoImprovement * 10), "repeated_without_improvement");
  add(s.retryLoopCount >= 2, Math.min(20, s.retryLoopCount * 5), "retry_loop");
  add(s.costRatio > 1, Math.min(20, Math.round((s.costRatio - 1) * 20)), "cost_envelope_exceeded");
  add(s.tokenRatio > 1, Math.min(20, Math.round((s.tokenRatio - 1) * 20)), "token_envelope_exceeded");
  add(s.staleEvidence, 15, "stale_evidence");
  add(s.goalContradictions > 0, Math.min(25, s.goalContradictions * 12), "goal_contradiction");
  add(s.rejectedActions > 0, Math.min(18, s.rejectedActions * 6), "rejected_actions");
  add(s.consecutiveHighRiskActions >= 2, Math.min(25, s.consecutiveHighRiskActions * 8), "high_risk_sequence");

  score = Math.min(100, score);
  const band: DriftResult["band"] = score >= 85 ? "critical" : score >= 70 ? "warning" : score >= 40 ? "watch" : "normal";
  return { score, band, autoPause: score >= 85, evidence };
}
