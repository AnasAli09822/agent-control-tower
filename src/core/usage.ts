export interface UsageEntry {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  cachedPerMillionUsd?: number;
}

export function calculateCostUsd(entry: UsageEntry): number {
  const uncachedInput = Math.max(0, entry.inputTokens - entry.cachedTokens);
  const cachedRate = entry.cachedPerMillionUsd ?? entry.inputPerMillionUsd;
  const cost =
    (uncachedInput / 1_000_000) * entry.inputPerMillionUsd +
    (entry.cachedTokens / 1_000_000) * cachedRate +
    (entry.outputTokens / 1_000_000) * entry.outputPerMillionUsd;
  return Math.round(cost * 1e8) / 1e8;
}
