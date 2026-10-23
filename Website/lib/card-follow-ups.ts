import type { FactCard } from "./types";

export type SavedFollowUpQuestions = { fingerprint: string; questions: string[] };

type FollowUpCard = Pick<FactCard, "title" | "hook" | "body" | "topicPath" | "sources"> & {
  claim?: string;
  sentences?: string[];
  answer?: string;
  learnMore?: string;
  answerSources?: FactCard["answerSources"];
  questionHistory?: FactCard["questionHistory"];
  explanations?: FactCard["explanations"];
  followUpQuestions?: FactCard["followUpQuestions"];
};

const stopWords = new Set("a an and are as at be been but by can could did do does for from had has have how i in into is it its of on or the this that to was were what when where which who why with".split(" "));
const facetPatterns: Array<{ key: string; question: RegExp; evidence: RegExp }> = [
  { key: "discovery", question: /\b(discover(?:ed|y)?|find|found|unearth(?:ed)?|excavat(?:ed|ion)|recover(?:ed|y))\b/i, evidence: /\b(discover(?:ed|y)?|find|found|unearth(?:ed)?|excavat(?:ed|ion)|recover(?:ed|y)|identified|located)\b/i },
  { key: "cause", question: /\b(why|cause|caused|led to|trigger(?:ed)?)\b/i, evidence: /\b(because|due to|caus(?:e|ed|es|ing)|trigger(?:ed|s|ing)?|result(?:ed|s|ing)? from|led to)\b/i },
  { key: "mechanism", question: /\b(work|works|working|function|functions|operate|operates|mechanism|process)\b/i, evidence: /\b(work(?:s|ed|ing)?|function(?:s|ed|ing)?|operat(?:e|es|ed|ing)|process(?:es)?)\b/i },
  { key: "chronology", question: /\b(after|next|later|following|happen(?:ed)?)\b/i, evidence: /\b(afterward|afterwards|later|subsequently|following|then|next)\b/i },
  { key: "place", question: /\b(where|location|located|found)\b/i, evidence: /\b(in|at|near|outside|within|located|found|discovered)\b/i }
];

function fingerprintText(card: Pick<FollowUpCard, "title" | "hook" | "body" | "topicPath" | "claim">) {
  return ["follow-up-v1", card.title ?? "", card.hook ?? "", card.body ?? "", card.claim ?? "", (card.topicPath ?? []).join("\u001f")].join("\u001e");
}

/** Shared with the native client. Keep the input as UTF-16 code units for identical hashes. */
export function followUpQuestionFingerprint(card: Pick<FollowUpCard, "title" | "hook" | "body" | "topicPath" | "claim">) {
  const source = fingerprintText(card);
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ (code + index), 2246822519);
  }
  return (first >>> 0).toString(16).padStart(8, "0") + (second >>> 0).toString(16).padStart(8, "0");
}

function cleanQuestion(value: unknown) {
  if (typeof value !== "string") return undefined;
  const question = value.replace(/\s+/g, " ").trim();
  const words = question.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu) ?? [];
  if (!question || question.length > 80 || words.length > 12 || !/\?$/u.test(question) || words.length < 3) return undefined;
  if (/^(?:what|how|why|when|where|who) (?:else|more|about it|is interesting)\?$/iu.test(question)) return undefined;
  return question;
}

function normalizeQuestion(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function terms(value: string) {
  return normalizeQuestion(value).split(/\s+/).filter(token => token.length > 2 && !stopWords.has(token));
}

function answeredBy(question: string, text: string) {
  if (!text.trim()) return false;
  const normalized = normalizeQuestion(text);
  const exact = normalizeQuestion(question);
  if (exact && normalized.includes(exact)) return true;
  const facet = facetPatterns.find(item => item.question.test(question));
  if (facet) return facet.evidence.test(text);
  const queryTerms = terms(question);
  if (queryTerms.length < 2) return false;
  const matches = queryTerms.filter(token => normalized.includes(token)).length;
  return matches >= 2 && matches / queryTerms.length >= 0.72;
}

function previouslyAsked(question: string, card: FollowUpCard) {
  const key = normalizeQuestion(question);
  return (card.questionHistory ?? []).some(item => item.role === "user" && normalizeQuestion(item.content) === key);
}

function responseContext(card: FollowUpCard) {
  return [card.answer, card.learnMore, ...(card.answerSources ?? []).map(source => source.extract),
    ...Object.values(card.explanations ?? {}).map(explanation => explanation?.text),
    ...(card.questionHistory ?? []).filter(item => item.role === "assistant").map(item => item.content)]
    .filter((value): value is string => Boolean(value)).join(" ");
}

function validCandidate(value: unknown, card: FollowUpCard) {
  const question = cleanQuestion(value);
  if (!question || previouslyAsked(question, card)) return undefined;
  const fullCard = [card.title, card.hook, card.claim, card.body, ...(card.sentences ?? [])].filter(Boolean).join(" ");
  const storedAnswers = responseContext(card);
  if (answeredBy(question, fullCard) || answeredBy(question, storedAnswers)) return undefined;
  return question;
}

function subjectFor(card: FollowUpCard) {
  const title = (card.title || card.topicPath?.at(-1) || "").replace(/\s*[\[(].*[\])]/g, "").trim();
  if (title.length >= 3 && title.length <= 55) return title;
  const topic = card.topicPath?.at(-1)?.trim();
  return topic && topic.length <= 55 ? topic : undefined;
}

function localCandidates(card: FollowUpCard) {
  const subject = subjectFor(card);
  if (!subject) return [];
  const body = [card.title, card.hook, card.claim, card.body, ...(card.sentences ?? [])].filter(Boolean).join(" ");
  const sourceText = (card.sources ?? []).map(source => `${source.title} ${source.extract ?? ""}`).join(" ");
  if (sourceText.length < 80) return [];
  const sourceNorm = normalizeQuestion(sourceText);
  const bodyNorm = normalizeQuestion(body);
  const candidates: string[] = [];
  const subjectTerms = terms(subject);
  const sourceNamesSubject = !subjectTerms.length || subjectTerms.some(token => sourceNorm.includes(token));
  if (!sourceNamesSubject) return [];
  const hasInSources = (pattern: RegExp) => pattern.test(sourceText);
  const hasInBody = (pattern: RegExp) => pattern.test(body);
  const options: Array<[RegExp, RegExp, string]> = [
    [/\b(discover(?:ed|y)?|unearth(?:ed)?|excavat(?:ed|ion)|recover(?:ed|y)|identified|located)\b/i, /\b(discover(?:ed|y)?|unearth(?:ed)?|excavat(?:ed|ion)|recover(?:ed|y)|identified|located|found)\b/i, `How was ${subject} discovered?`],
    [/\b(because|due to|caus(?:e|ed|es|ing)|trigger(?:ed|s|ing)?|led to|result(?:ed|s|ing) from)\b/i, /\b(because|due to|caus(?:e|ed|es|ing)|trigger(?:ed|s|ing)?|led to|result(?:ed|s|ing) from)\b/i, `What caused ${subject}?`],
    [/\b(mechanism|works?|functions?|operates?|how it works)\b/i, /\b(mechanism|works?|functions?|operates?|how it works)\b/i, `How does ${subject} work?`],
    [/\b(afterward|afterwards|later|subsequently|following|then)\b/i, /\b(afterward|afterwards|later|subsequently|following|then)\b/i, `What happened after ${subject}?`]
  ];
  for (const [sourcePattern, bodyPattern, question] of options) {
    if (hasInSources(sourcePattern) && !hasInBody(bodyPattern)) candidates.push(question);
  }
  // A source may establish an additional location while the card omits it. Only ask when the article clearly discusses a place.
  if (/\b(located|found|discovered|excavated)\b/i.test(sourceText) && /\b(in|near|at)\s+[A-Z][\p{L}'’.-]+/u.test(sourceText)
    && !/\b(in|near|at)\s+[A-Z][\p{L}'’.-]+/u.test(body)) candidates.push(`Where was ${subject} found?`);
  return candidates;
}

function selectQuestions(candidates: unknown[], card: FollowUpCard, fillFromLocal: boolean) {
  const selected: string[] = [];
  const seen = new Set<string>();
  const accept = (value: unknown) => {
    const question = validCandidate(value, card);
    if (!question) return;
    const key = normalizeQuestion(question);
    if (seen.has(key)) return;
    // Avoid repeating the same angle with slightly different wording.
    const angle = facetPatterns.find(item => item.question.test(question))?.key;
    if (angle && selected.some(existing => facetPatterns.find(item => item.question.test(existing))?.key === angle)) return;
    seen.add(key);
    selected.push(question);
  };
  candidates.forEach(accept);
  if (fillFromLocal && selected.length < 2) localCandidates(card).forEach(accept);
  return selected.slice(0, 2);
}

export function createSavedFollowUpQuestions(candidates: unknown, card: FollowUpCard): SavedFollowUpQuestions | undefined {
  const values = Array.isArray(candidates) ? candidates : [];
  const questions = selectQuestions(values, card, true);
  return questions.length ? { fingerprint: followUpQuestionFingerprint(card), questions } : undefined;
}

export function normalizeSavedFollowUpQuestions(value: unknown, card: FollowUpCard): SavedFollowUpQuestions | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const stored = value as Partial<SavedFollowUpQuestions>;
  if (stored.fingerprint !== followUpQuestionFingerprint(card) || !Array.isArray(stored.questions)) return undefined;
  const questions = selectQuestions(stored.questions, card, true);
  return questions.length ? { fingerprint: stored.fingerprint, questions } : undefined;
}

export function getCardFollowUpQuestions(card: FollowUpCard) {
  const stored = normalizeSavedFollowUpQuestions(card.followUpQuestions, card);
  return stored?.questions ?? selectQuestions([], card, true);
}
