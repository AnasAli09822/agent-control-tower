import type { RiskInput, RiskResult } from "./types.ts";

const forbidden = new Set([
  "crm.delete_record",
  "support.refund_over_500",
]);

export function assessRisk(input: RiskInput): RiskResult {
  const reasons: string[] = [];
  let score = 0;

  if (!input.inTaskScope) {
    reasons.push("outside_task_scope");
    score += 55;
  }
  if (input.environment === "production") {
    reasons.push("production_environment");
    score += 24;
  }
  if (!input.reversible) {
    reasons.push("low_reversibility");
    score += 18;
  }
  if ((input.financialImpactUsd ?? 0) > 200) {
    reasons.push("financial_impact_gt_200");
    score += 28;
  }
  if ((input.affectedRecords ?? 0) > 5) {
    reasons.push("multi_record_blast_radius");
    score += 18;
  }
  if ((input.evidenceFreshnessMinutes ?? 0) > 30) {
    reasons.push("stale_evidence");
    score += 15;
  }
  if (input.driftScore >= 70) {
    reasons.push("agent_drift_high");
    score += 25;
  }
  if (input.retryCount >= 2) {
    reasons.push("repeated_attempts");
    score += 12;
  }

  if (forbidden.has(input.toolName)) {
    return { score: 100, decision: "block", reasons: [...reasons, "hard_policy_block"] };
  }

  score = Math.min(100, score);
  if (!input.inTaskScope) return { score, decision: "block", reasons };
  if (score >= 55) return { score, decision: "require_approval", reasons };
  return { score, decision: "allow", reasons };
}
