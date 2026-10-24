import { readFileSync, writeFileSync as write } from 'node:fs';
// Every generator uses this boundary, including single-generator checks.
export function writeFileSync(target, value, options) {
  if (!process.argv.includes('--check')) return write(target, value, options);
  let current;
  try { current = readFileSync(target); } catch { throw new Error(`Missing generated file: ${target}`); }
  if (!current.equals(Buffer.isBuffer(value) ? value : Buffer.from(value))) throw new Error(`Stale generated file: ${target}. Run npm run generate:native.`);
}
