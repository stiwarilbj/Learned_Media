import policy from "./fact-angle-policy.json";

export const FACT_ANGLE_OPTIONS = policy;
export type FactAngle = "varied" | "unexpected-mechanism" | "unusual-decision" | "failed-experiment" | "overlooked-detail";

export function isFactAngle(value: unknown): value is FactAngle {
  return typeof value === "string" && policy.some((item) => item.id === value);
}

/** Omitted context is the ordinary varied mode; explicitly invalid values are rejected. */
export function normalizeFactAngle(value: unknown): FactAngle {
  if (value === undefined) return "varied";
  if (!isFactAngle(value)) throw new RangeError("Choose a supported fact angle before generating a batch.");
  return value;
}

export function factAngleDefinition(value: FactAngle) {
  return policy.find((item) => item.id === value) ?? policy[0];
}
