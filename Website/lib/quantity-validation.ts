import numberWords from "./quantity-number-words.json";
import units from "./quantity-units.json";

type Quantity = { text: string; value: number; unit?: typeof units[number]; literalUnit?: string; delta?: boolean; magnitudeScale?: number; approximate: boolean; decimals: number };
const aliasMap = new Map(units.flatMap(unit => unit.aliases.map(alias => [alias, unit] as const)));
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const unitPattern = new RegExp("^(?:" + [...aliasMap.keys()].sort((a,b) => b.length-a.length).map(escape).join("|") + ")(?![a-zA-Z])", "i");
const numberPattern = /(?<![\p{L}\p{N}_.,+−-])[+−-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:e[+−-]?\d+)?(?![\p{N}_]|[.,]\d)/giu;
const wholeNumber = new RegExp("^(?:" + numberPattern.source + ")$", "iu");

const words = Object.keys(numberWords).sort((a,b)=>b.length-a.length).map(escape).join("|");
const hundredPattern = "(?:one|two|three|four|five|six|seven|eight|nine) hundred(?: (?:and )?(?:" + words + "))?";
const wordPattern = new RegExp("\\b(?:" + hundredPattern + "|" + words + ")(?=(?:\\s+|[-‑])(?:(?:thousand|million|billion)\\s+)?(?:" + [...aliasMap.keys()].sort((a,b)=>b.length-a.length).map(escape).join("|") + ")(?![a-zA-Z]))", "gi");
function wordValue(word: string) {
  const value = word.toLowerCase();
  const hundred = value.match(/^(one|two|three|four|five|six|seven|eight|nine) hundred(?: (?:and )?(.+))?$/u);
  const lookup = (key: string) => numberWords[key as keyof typeof numberWords];
  return hundred ? lookup(hundred[1])*100 + (hundred[2] ? lookup(hundred[2]) : 0) : lookup(value);
}
/** Parse digit quantities conservatively. Calendar units and ambiguous units never convert. */
function quantities(text: string): Quantity[] {
  text = text.replace(wordPattern, word => String(wordValue(word)));
  text = text.replace(/(?<=\d)[-–—−](?=\d)/gu, " – ");
  let occupiedThrough = 0;
  const result = [...text.matchAll(numberPattern)].flatMap<Quantity>(match => {
    const start = match.index, end = start + match[0].length;
    if (start < occupiedThrough) return [];
    let value = Number(match[0].replace(/,/g, "").replace(/−/g, "-"));
    const significantDigits = match[0].split(/[eE]/u)[0].replace(/[^0-9]/gu, "").replace(/^0+|0+$/gu, "").length;
    if (!Number.isFinite(value) || significantDigits > 15) return [{ text: match[0], value: NaN, approximate: false, decimals: 0 }];
    const magnitude = text.slice(end).match(/^\s+(hundred|thousand|million|billion)\b/iu);
    const magnitudeScale = magnitude ? ({hundred:100,thousand:1000,million:1e6,billion:1e9} as Record<string,number>)[magnitude[1].toLowerCase()] : 1;
    value *= magnitudeScale;
    const tail = text.slice(end + (magnitude?.[0].length ?? 0)), whitespace = tail.match(/^(?:\s*[-‑]\s*(?=[a-zA-Z°])|\s*)/u)![0].length;
    const token = tail.slice(whitespace).match(unitPattern)?.[0];
    const unit = token ? aliasMap.get(token.toLowerCase()) : undefined;
    // Do not misread a longer word or an unsupported compound as a simple unit.
    const unknown = !unit && whitespace === 0 ? tail.match(/^[\p{L}][\p{L}\p{N}-]*/u)?.[0] : undefined;
    const suffix = token ? tail.slice(whitespace + token.length) : "";
    const compound = suffix.match(/^(?:[\/²³^][^\s,;.!?]*|\s+per\s+[^\s,;.!?]+|\s+(?:squared|cubed)\b)/iu)?.[0];
    occupiedThrough = end + (magnitude?.[0].length ?? 0) + whitespace + (token?.length ?? unknown?.length ?? 0) + (compound?.length ?? 0);
    return [{ text: match[0] + (magnitude?.[0] ?? "") + (token ? tail.slice(0, whitespace + token.length) + (compound ?? "") : (unknown ?? "")), value: Number.isFinite(value) ? value : NaN,
      unit: compound ? undefined : unit, literalUnit: compound ? token!.toLowerCase() + compound.toLowerCase() : unknown?.toLowerCase(),
      magnitudeScale,
      delta: unit?.dimension === "temperature" && !/\b(?:from|to|at|between)\s*$/iu.test(text.slice(0,start)) && (/\b(?:rose|rise|increased|increase|decreased|decrease|dropped|drop|difference|change|changed)\b[^.!?]{0,35}$/iu.test(text.slice(0,start)) || /^\s+(?:higher|lower|warmer|cooler|colder|difference)\b/iu.test(suffix)),
      approximate: /\b(?:about|approximately|around|roughly|circa)\s*$/iu.test(text.slice(Math.max(0,start-30),start)),
      decimals: match[0].includes("e") || match[0].includes("E") ? -1 : (match[0].split(".")[1]?.length ?? 0) }];
  });
  // Reject unsupported numerical formatting beside a known unit rather than ignoring it.
  for (const match of text.matchAll(/\d+(?:[.,]\d+)+/gu)) {
    if (!wholeNumber.test(match[0]) && unitPattern.test(text.slice(match.index + match[0].length).trimStart())) {
      result.push({text: match[0], value: NaN, approximate: false, decimals: 0});
    }
  }
  return result;
}
function equivalent(claim: Quantity, source: Quantity) {
  if (!Number.isFinite(claim.value) || !Number.isFinite(source.value)) return false;
  if (claim.literalUnit || source.literalUnit) return claim.literalUnit === source.literalUnit && claim.value === source.value;
  if (!claim.unit || !source.unit) return !claim.unit && !source.unit && claim.value === source.value;
  if (claim.unit.dimension !== source.unit.dimension || Boolean(claim.delta) !== Boolean(source.delta)) return false;
  if (claim.unit.id === source.unit.id) return claim.value === source.value;
  const converted = (source.value * source.unit.factor + (source.delta ? 0 : source.unit.offset) - (claim.delta ? 0 : claim.unit.offset)) / claim.unit.factor;
  const epsilon = Math.max(Math.abs(converted),Math.abs(claim.value)) * Number.EPSILON * 16;
  if (Math.abs(converted-claim.value) <= epsilon) return true;
  // Rounded conversions must be explicitly approximate and equal deterministic rounding.
  if (!claim.approximate || claim.decimals < 0 || claim.decimals > 9) return false;
  const scale = 10 ** claim.decimals / (claim.magnitudeScale ?? 1);
  const rounded = Math.sign(converted) * Math.floor(Math.abs(converted) * scale + .5) / scale;
  return Math.abs(rounded-claim.value) <= epsilon;
}

/** Reuse exact quotation parsing within one draft, never its evidence assignments. */
export function createQuantityValidator() {
  const parsedPassages = new Map<string, Quantity[]>();
  return (claim: string, passages: string[]): string[] => {
    const sources = passages.flatMap(passage => {
      let parsed = parsedPassages.get(passage);
      if (parsed === undefined) {
        parsed = quantities(passage);
        parsedPassages.set(passage, parsed);
      }
      return parsed;
    });
    return [...new Set(quantities(claim).filter(quantity => !sources.some(source => equivalent(quantity,source))).map(quantity => quantity.text))];
  };
}

/** Report unsupported quantities using only the passages assigned to this claim/sentence. */
export function unsupportedQuantities(claim: string, passages: string[]): string[] {
  return createQuantityValidator()(claim, passages);
}
