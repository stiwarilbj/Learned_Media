/** A normal fallback pass, followed by two bounded recovery cycles. */
export function geminiAttemptRounds(models: readonly string[], primaryModels: readonly string[], recover = true): string[][] {
  const uniqueModels = Array.from(new Set(models));
  if (!recover) return [uniqueModels];
  const primaries = primaryModels.filter(model => uniqueModels.includes(model));
  const others = uniqueModels.filter(model => !primaryModels.includes(model));
  const recovery = [...Array.from({ length: 3 }, () => primaries).flat(), ...others];
  return [uniqueModels, recovery, [...recovery]];
}
