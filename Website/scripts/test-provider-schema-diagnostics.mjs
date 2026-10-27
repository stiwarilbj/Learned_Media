import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { after, test } from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../..', import.meta.url));
const directory = mkdtempSync(path.join(tmpdir(), 'learned-schema-diagnostics-'));
after(() => rmSync(directory, { recursive: true, force: true }));
const source = readFileSync(path.join(root, 'Website/lib/provider-schema-diagnostics.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const browser = { exports: {}, window: {} };
runInNewContext(code, browser);
const api = browser.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const ordered = values => plain(values).sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));

const payload = {
  error: { code: 400, info: 'PRIVATE', message: 'PRIVATE', status: 'PRIVATE', errors: [{ reason: 'PRIVATE' }] },
  query: { normalized: [], redirects: [], search: [{ title: 'PRIVATE' }], pages: [{
    title: 'PRIVATE', fullurl: 'PRIVATE', extract: 'PRIVATE', pageimage: 'PRIVATE', thumbnail: { source: 'PRIVATE' },
    original: { source: 'PRIVATE' }, coordinates: [{ lat: 1.25, lon: -2 }], pageprops: { disambiguation: '' },
    imageinfo: [{ url: 'PRIVATE', thumburl: 'PRIVATE', descriptionurl: 'PRIVATE', extmetadata: {} }]
  }] },
  title: 'PRIVATE', thumbnail: { source: 'PRIVATE' }, originalimage: { source: 'PRIVATE' }, content_urls: { desktop: { page: 'PRIVATE' } },
  items: [{ id: { channelId: 'PRIVATE', videoId: 'PRIVATE' }, snippet: {
    title: 'PRIVATE', customUrl: 'PRIVATE', thumbnails: {}, channelTitle: 'PRIVATE', channelId: 'PRIVATE',
    description: 'PRIVATE', publishedAt: 'PRIVATE', tags: []
  }, contentDetails: { relatedPlaylists: { uploads: 'PRIVATE' }, videoId: 'PRIVATE', duration: 'PRIVATE' },
  status: { privacyStatus: 'PRIVATE', embeddable: true } }], nextPageToken: 'PRIVATE'
};

// Captured before generation replaced the hand-maintained definitions. These hashes
// protect existing schema IDs, path order, observed types and occurrence counts.
const baseline = {
  'wikipedia.search': '80916a685b701a577b124fea0e4389ca265607f5e99aa95d4b83f5932a4df534',
  'wikipedia.pages': 'ba0676abe9f9892eea9ca2d519987edb66caa3e4179dfcaa72f3190694855b80',
  'wikipedia.images': '064dc6c4b3eefa665620709a25fb60db560704ef367e254f9789c66ab07a6433',
  'wikipedia.summary': '7144d4a4f92257d65dc2e204c0bfb52a457c766af0cd92dea637414bacd089b1',
  'youtube.channels': 'f8a67e85627d61f75d7d6ae49ac8ed89194deacfc7a70468d3c9b0b2a35553af',
  'youtube.search': 'f4061b104259d38b231ec3f3a17171ad9ce094767a90225a09ef813ec315c2c8',
  'youtube.playlistItems': '84e2a8b295d6c594c3fff2478187198dab4ae64be1fe63e402dfc19508a442e7',
  'youtube.videos': '9806c7c241f2d346e4b879957d619e081c60736aa1b6078ce1136ec215cbe005',
  'youtube.error': 'f9c5e847f22844283f15a72f8ebab0aa0f8245294640f8e81ea570e7774dfc31'
};
const groups = Object.keys(baseline).map(schema => [
  ...[payload, {}, null, [], true, 42, 'PRIVATE'].map(payload => ({ schema, payload })),
  ...['invalid-json', 'non-json'].map(rootOverride => ({ schema, rootOverride }))
]);
// Exercise nested missing/null/array paths as well as the bounded ring.
groups.push(Object.keys(baseline).flatMap(schema => [
  { schema, payload: { items: [], query: { pages: [] }, error: null } },
  { schema, payload: { items: [null], query: { pages: [null] }, error: [] } },
  { schema, payload: { items: [{ id: 'PRIVATE', snippet: { title: null, tags: false } }], query: { search: {}, pages: {} } } },
  { schema, payload: { items: [null, payload.items[0]], query: { pages: [null, payload.query.pages[0]] } } },
  { schema, payload: { items: { 0: payload.items[0] }, query: { pages: { 0: payload.query.pages[0] } } } },
  { schema, payload: { items: [false], query: { pages: [{ imageinfo: [[], payload.query.pages[0].imageinfo[0]], coordinates: [] }] } } }
]));
groups.push(Array.from({ length: 80 }, (_, i) => ({ schema: 'youtube.videos', payload: i % 3 ? payload : {} })));
const ringShapes = [payload, {}, null, [], true, 42, 'PRIVATE', { items: [] }, { items: [null] },
  { items: [{}] }, { items: [{ snippet: null }] }, { query: { pages: [] } }, { query: { pages: [null] } },
  { error: [] }, { error: { code: 'PRIVATE' } }];
groups.push(Array.from({ length: 777 }, (_, index) => ({
  schema: Object.keys(baseline)[(index * 7 + Math.floor(index / 13)) % Object.keys(baseline).length],
  payload: ringShapes[(index * 11 + Math.floor(index / 9)) % ringShapes.length],
  rootOverride: index % 29 === 0 ? (index % 58 === 0 ? 'non-json' : 'invalid-json') : undefined
})));
function browserSnapshot(group) {
  api.resetProviderSchemaFailures();
  for (const item of group) api.recordProviderSchemaFailure(item.schema, item.payload, item.rootOverride);
  return plain(api.providerSchemaFailureSnapshot());
}

test('existing browser fingerprints keep the exact pre-change representation', () => {
  assert.deepEqual(Object.keys(api.providerSchemaFields), Object.keys(baseline));
  for (const group of groups.slice(0, 9)) {
    const snapshot = browserSnapshot(group);
    assert.equal(createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'), baseline[group[0].schema]);
    assert.equal(JSON.stringify(snapshot).includes('PRIVATE'), false);
  }
});

test('prepared traversal matches the original path reader for every fixture', () => {
  function originalReadPath(value, path) {
    if (path === '$') return value;
    let current = value;
    for (const segment of path.split('.')) {
      const arrayIndex = segment.endsWith('[0]');
      const key = arrayIndex ? segment.slice(0, -3) : segment;
      if (!current || typeof current !== 'object' || Array.isArray(current) || !Object.prototype.hasOwnProperty.call(current, key)) return undefined;
      current = current[key];
      if (arrayIndex) current = Array.isArray(current) ? current[0] : undefined;
    }
    return current;
  }
  function type(value) {
    if (value === undefined) return 'missing';
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return ['object', 'string', 'number', 'boolean'].includes(typeof value) ? typeof value : 'other';
  }
  const cases = groups.flat().concat([
    { schema: 'youtube.videos', payload: Object.create({ items: payload.items }) },
    { schema: 'youtube.error', payload, rootOverride: 'PRIVATE' }
  ]);
  for (const item of cases) {
    const override = ['invalid-json', 'non-json'].includes(item.rootOverride) ? item.rootOverride : undefined;
    const expected = item.schema + '|' + api.providerSchemaFields[item.schema].map(path => `${path}:${path === '$' && override ? override : type(originalReadPath(item.payload, path))}`).join(',');
    assert.deepEqual(browserSnapshot([item]), [{ fingerprint: expected, count: 1 }]);
  }
});

test('circular history retains exactly the newest 64 fingerprints across repeated wraps and reset', () => {
  const events = groups.at(-1);
  assert.equal(events.length, 777);
  assert.deepEqual(ordered(browserSnapshot(events)), ordered(browserSnapshot(events.slice(-64))));
  assert.equal(browserSnapshot(events).reduce((sum, item) => sum + item.count, 0), 64);
  api.resetProviderSchemaFailures();
  assert.deepEqual(plain(api.providerSchemaFailureSnapshot()), []);
  api.recordProviderSchemaFailure('youtube.videos', payload);
  assert.equal(api.providerSchemaFailureSnapshot().reduce((sum, item) => sum + item.count, 0), 1);
});

test('paths compile once and remain immutable across recording, reset and all schemas', () => {
  const sandbox = { exports: {}, window: {} };
  runInNewContext(`
    globalThis.pathOperations = { split: 0, endsWith: 0, slice: 0 };
    for (const method of Object.keys(pathOperations)) {
      const original = String.prototype[method];
      String.prototype[method] = function (...args) {
        pathOperations[method]++;
        return Reflect.apply(original, this, args);
      };
    }
  `, sandbox);
  // Inspect private metadata in this test context, without a production API.
  runInNewContext(code + '\nexports.testPaths = preparedSchemaFields;', sandbox);
  const initial = plain(sandbox.pathOperations);
  assert.equal(initial.split, Object.values(api.providerSchemaFields).flat().filter(path => path !== '$').length);
  assert.ok(initial.endsWith > initial.split && initial.slice > 0);
  for (const fields of sandbox.exports.testPaths.values()) {
    assert.ok(Object.isFrozen(fields));
    for (const field of fields) {
      assert.ok(Object.isFrozen(field) && Object.isFrozen(field.steps));
      assert.ok(field.steps.every(Object.isFrozen));
    }
  }
  for (let repeat = 0; repeat < 100; repeat++) {
    for (const schema of Object.keys(baseline)) sandbox.exports.recordProviderSchemaFailure(schema, payload);
  }
  assert.equal(sandbox.exports.providerSchemaFailureSnapshot().reduce((sum, item) => sum + item.count, 0), 64);
  sandbox.exports.resetProviderSchemaFailures();
  sandbox.exports.recordProviderSchemaFailure('youtube.videos', {});
  assert.deepEqual(plain(sandbox.pathOperations), initial, 'no path parsing after metadata initialization');
});

test('throwing payload accessors remain isolated from response handling and diagnostics', () => {
  const unsafe = Object.defineProperty({}, 'items', { get() { throw new Error('PRIVATE'); } });
  api.resetProviderSchemaFailures();
  assert.doesNotThrow(() => api.recordProviderSchemaFailure('youtube.videos', unsafe));
  assert.deepEqual(plain(api.providerSchemaFailureSnapshot()), []);
});

test('generated Swift definitions and actual native fingerprints equal the browser for every schema', () => {
  const harness = path.join(directory, 'Harness.swift');
  const binary = path.join(directory, 'fingerprints');
  writeFileSync(harness, `
import Foundation
@main struct Runner {
  static func main() throws {
    let groups = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))) as! [[[String: Any]]]
    let snapshots = groups.map { group -> Any in
      let diagnostics = PerformanceDiagnostics()
      for item in group {
        diagnostics.recordProviderSchemaFailure(ProviderResponseSchema(rawValue: item["schema"] as! String)!, payload: item["payload"],
          rootOverride: (item["rootOverride"] as? String).flatMap(ProviderResponseRootOverride.init(rawValue:)))
      }
      return diagnostics.snapshot()["providerSchemaFailures"]!
    }
    let definitions = ProviderResponseSchema.allCases.map { ["id": $0.rawValue, "fields": $0.fields] as [String: Any] }
    let result = try JSONSerialization.data(withJSONObject: ["definitions": definitions, "snapshots": snapshots], options: [.sortedKeys])
    FileHandle.standardOutput.write(result)
  }
}
`);
  execFileSync('swiftc', [path.join(root, 'App/Sources/LearnedMediaCore/PerformanceDiagnostics.swift'),
    path.join(root, 'App/Sources/LearnedMediaCore/ProviderResponseSchema.generated.swift'), harness, '-o', binary], { timeout: 120_000 });
  const input = path.join(directory, 'cases.json');
  writeFileSync(input, JSON.stringify(groups));
  const result = JSON.parse(execFileSync(binary, [input], { encoding: 'utf8' }));
  assert.deepEqual(result.definitions, plain(Object.entries(api.providerSchemaFields).map(([id, fields]) => ({ id, fields }))));
  assert.deepEqual(result.snapshots.map(ordered), groups.map(group => ordered(browserSnapshot(group))));
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.equal(result.snapshots.at(-1).reduce((sum, value) => sum + value.count, 0), 64);
});

test('Mac frontend uses the same generated fingerprints and server runtimes retain nothing', () => {
  const frontend = { window: {} };
  const runtime = readFileSync(path.join(root, 'App/Resources/frontend/performance-diagnostics.js'), 'utf8');
  const boundary = 'const require = () => schema;';
  assert.ok(runtime.includes(boundary));
  // Expose the otherwise private module only in this isolated test context.
  runInNewContext(runtime.replace(boundary, 'scope.testSchema = schema; ' + boundary), frontend);
  const snapshot = frontend.LEARNED_MEDIA_DIAGNOSTICS.performanceDiagnostics;
  // The generated frontend exposes diagnostics through the same existing inspection hook.
  assert.ok(snapshot);
  for (const group of groups) {
    snapshot.reset();
    for (const item of group) frontend.testSchema.recordProviderSchemaFailure(item.schema, item.payload, item.rootOverride);
    assert.deepEqual(ordered(snapshot.snapshot().providerSchemaFailures), ordered(browserSnapshot(group)));
  }
  snapshot.reset();
  const server = { exports: {} };
  runInNewContext(code, server);
  server.exports.recordProviderSchemaFailure('youtube.videos', payload);
  assert.deepEqual(plain(server.exports.providerSchemaFailureSnapshot()), []);
  api.resetProviderSchemaFailures();
  api.recordProviderSchemaFailure('unknown.endpoint', payload);
  assert.deepEqual(plain(api.providerSchemaFailureSnapshot()), []);
  assert.deepEqual(plain(snapshot.snapshot().providerSchemaFailures), []);
});

test('changing one definition regenerates both outputs and stale checks are read-only', () => {
  const sandbox = path.join(directory, 'generation');
  for (const name of ['Website/scripts', 'Website/lib', 'App/Resources/frontend', 'App/Sources/LearnedMediaCore']) mkdirSync(path.join(sandbox, name), { recursive: true });
  symlinkSync(path.join(root, 'Website/node_modules'), path.join(sandbox, 'Website/node_modules'), 'dir');
  for (const name of ['Website/scripts/build-native-diagnostics.mjs', 'Website/scripts/generated-output.mjs',
    'Website/lib/provider-schema-diagnostics.ts', 'Website/lib/performance-diagnostics.ts',
    'App/Resources/frontend/performance-diagnostics.js', 'App/Sources/LearnedMediaCore/ProviderResponseSchema.generated.swift']) {
    copyFileSync(path.join(root, name), path.join(sandbox, name));
  }
  const script = path.join(sandbox, 'Website/scripts/build-native-diagnostics.mjs');
  execFileSync(process.execPath, [script, '--check']);
  const swift = path.join(sandbox, 'App/Sources/LearnedMediaCore/ProviderResponseSchema.generated.swift');
  const runtime = path.join(sandbox, 'App/Resources/frontend/performance-diagnostics.js');
  const before = [swift, runtime].map(file => readFileSync(file));
  const definition = path.join(sandbox, 'Website/lib/provider-schema-diagnostics.ts');
  writeFileSync(definition, source.replace('"youtube.error": [', '"youtube.testEndpoint": ["$", "items", "items[0].value"],\n  "youtube.error": [')
    .replace('"youtube.error": ["$",', '"youtube.error": ["$", "error.newField",'));
  const check = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.notEqual(check.status, 0);
  assert.match(check.stderr, /Stale generated file/);
  for (const [index, file] of [swift, runtime].entries()) assert.deepEqual(readFileSync(file), before[index]);
  execFileSync(process.execPath, [script]);
  assert.match(readFileSync(swift, 'utf8'), /case youtubeTestEndpoint = "youtube.testEndpoint"/);
  assert.match(readFileSync(swift, 'utf8'), /case \.youtubeError: return \["\$", "error.newField",/);
  assert.match(readFileSync(runtime, 'utf8'), /youtube\.testEndpoint/);
  assert.match(readFileSync(runtime, 'utf8'), /"error.newField"/);
  execFileSync(process.execPath, [script, '--check']);
  const valid = [swift, runtime].map(file => readFileSync(file));
  writeFileSync(definition, source.replace('"youtube.error": ["$",', '"youtube.error": ["$", "$",'));
  const invalid = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Invalid provider schema paths/);
  for (const [index, file] of [swift, runtime].entries()) assert.deepEqual(readFileSync(file), valid[index]);
});
