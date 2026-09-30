export interface GuardInput {
  agentState: string;
  currentEpoch: bigint;
  workerEpoch: bigint;
}

export function assertWorkerMayMutate(input: GuardInput): void {
  if (input.currentEpoch !== input.workerEpoch) throw new Error("stale_control_epoch");
  if (input.agentState === "killed") throw new Error("agent_killed");
}

export function killEpoch(currentEpoch: bigint): bigint {
  return currentEpoch + 1n;
}
