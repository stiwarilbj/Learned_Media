export type CardTextFields = { title?: string | null; hook?: string | null; body?: string | null };

type ToolFingerprint = { dependencies: readonly unknown[]; fingerprint: string };
type CardFingerprintState = {
  title: unknown;
  hook: unknown;
  body: unknown;
  contentFingerprint: string;
  toolFingerprints: Map<string, ToolFingerprint>;
};

const states = new WeakMap<object, CardFingerprintState>();

function hash(source: string) {
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ (code + index), 2246822519);
  }
  return (first >>> 0).toString(16).padStart(8, "0") + (second >>> 0).toString(16).padStart(8, "0");
}

function sameDependencies(left: readonly unknown[], right: readonly unknown[]) {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}

function stateFor(card: object & CardTextFields) {
  let state = states.get(card);
  if (state && Object.is(state.title, card.title) && Object.is(state.hook, card.hook) && Object.is(state.body, card.body)) return state;

  state = {
    title: card.title,
    hook: card.hook,
    body: card.body,
    contentFingerprint: `card-text-v1:${hash(JSON.stringify([card.title, card.hook, card.body]))}`,
    toolFingerprints: new Map()
  };
  states.set(card, state);
  return state;
}

/** Transient fingerprint for the card's authored text. Nothing is persisted or retained past the card object. */
export function cardContentFingerprint(card: object & CardTextFields) {
  return stateFor(card).contentFingerprint;
}

/** Reuses a tool's existing fingerprint while authored text and that tool's own dependencies are unchanged. */
export function memoizedCardFingerprint(card: object & CardTextFields, tool: string, dependencies: readonly unknown[], calculate: () => string) {
  const state = stateFor(card);
  const cached = state.toolFingerprints.get(tool);
  if (cached && sameDependencies(cached.dependencies, dependencies)) return cached.fingerprint;

  const fingerprint = calculate();
  state.toolFingerprints.set(tool, { dependencies: [...dependencies], fingerprint });
  return fingerprint;
}
