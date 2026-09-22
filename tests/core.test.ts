import test from "node:test";
import assert from "node:assert/strict";
import { canTransition, requireTransition } from "../src/core/state-machine.ts";
import { assessRisk } from "../src/core/risk.ts";
import { scoreDrift } from "../src/core/drift.ts";
import { assertWorkerMayMutate, killEpoch } from "../src/core/control-epoch.ts";
import { calculateCostUsd } from "../src/core/usage.ts";

test("state machine permits operational transitions and keeps killed terminal", () => {
  assert.equal(canTransition("running", "paused"), true);
  assert.equal(canTransition("paused", "running"), true);
  assert.equal(canTransition("running", "killed"), true);
  assert.equal(canTransition("killed", "running"), false);
  assert.throws(() => requireTransition("killed", "running"), /invalid_agent_transition/);
});

test("kill increments epoch and stale worker is rejected", () => {
  const previous = 4n;
  const current = killEpoch(previous);
  assert.equal(current, 5n);
  assert.throws(() => assertWorkerMayMutate({ agentState: "killed", currentEpoch: current, workerEpoch: previous }), /stale_control_epoch/);
  assert.throws(() => assertWorkerMayMutate({ agentState: "running", currentEpoch: current, workerEpoch: previous }), /stale_control_epoch/);
  assert.doesNotThrow(() => assertWorkerMayMutate({ agentState: "running", currentEpoch: current, workerEpoch: current }));
});

test("risk gate requires approval for consequential production mutation", () => {
  const result = assessRisk({
    toolName: "infra.change_rate_limit",
    environment: "production",
    affectedRecords: 1,
    reversible: true,
    evidenceFreshnessMinutes: 8,
    driftScore: 45,
    retryCount: 1,
    inTaskScope: true,
    financialImpactUsd: 0,
  });
  assert.equal(result.decision, "allow");

  const high = assessRisk({
    toolName: "infra.rollback_release",
    environment: "production",
    affectedRecords: 10,
    reversible: false,
    evidenceFreshnessMinutes: 60,
    driftScore: 75,
    retryCount: 3,
    inTaskScope: true,
    financialImpactUsd: 0,
  });
  assert.equal(high.decision, "require_approval");
  assert.ok(high.score >= 55);
});

test("out-of-scope action is blocked", () => {
  const result = assessRisk({
    toolName: "crm.update_stage",
    environment: "sandbox",
    reversible: true,
    driftScore: 0,
    retryCount: 0,
    inTaskScope: false,
  });
  assert.equal(result.decision, "block");
});

test("rogue signals cross critical threshold and auto-pause", () => {
  const result = scoreDrift({
    outOfScopeAttempts: 2,
    repeatedNoImprovement: 3,
    retryLoopCount: 4,
    costRatio: 1.5,
    tokenRatio: 1.4,
    staleEvidence: true,
    goalContradictions: 2,
    rejectedActions: 2,
    consecutiveHighRiskActions: 3,
  });
  assert.equal(result.band, "critical");
  assert.equal(result.autoPause, true);
  assert.ok(result.score >= 85);
});

test("usage cost is additive without charging cached tokens twice", () => {
  const cost = calculateCostUsd({
    inputTokens: 1_000_000,
    outputTokens: 500_000,
    cachedTokens: 250_000,
    inputPerMillionUsd: 2,
    outputPerMillionUsd: 8,
    cachedPerMillionUsd: 0.5,
  });
  assert.equal(cost, 5.625);
});
