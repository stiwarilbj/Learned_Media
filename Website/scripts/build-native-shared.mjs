import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scripts = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../..', import.meta.url));
const check = process.argv.includes('--check');
const self = path.basename(fileURLToPath(import.meta.url));
const targets = ['App/Resources/frontend', 'App/Sources/LearnedMediaCore'];

function snapshot() {
  const files = new Map();
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (entry.isFile()) files.set(path.relative(root, filename), readFileSync(filename));
    }
  };
  for (const target of targets) visit(path.join(root, target));
  return files;
}

const before = check ? snapshot() : undefined;
// Discover generators so a new generated catalog cannot silently miss the CI check.
const generators = readdirSync(scripts).filter(name => /^build-native-.*\.mjs$/.test(name) && name !== self).sort();
if (!generators.length) throw new Error('No shared native generators found.');
for (const generator of generators) {
  console.log(`Regenerating shared native data: ${generator}`);
  const result = spawnSync(process.execPath, [path.join(scripts, generator)], { cwd: path.join(root, 'Website'), stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${generator} failed (${result.signal ?? result.status}).`);
}
if (check) {
  const after = snapshot();
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(name => !before.get(name)?.equals(after.get(name) ?? Buffer.alloc(0)) || !after.has(name));
  if (changed.length) {
    console.error(`Shared native files are stale:\n${changed.map(name => `  ${name}`).join('\n')}\nRun npm run generate:native in Website, rebuild the Mac app if frontend resources changed, and commit the generated files. This check leaves regenerated files available for inspection.`);
    process.exitCode = 1;
  } else console.log(`Shared native files match all ${generators.length} generators.`);
}
