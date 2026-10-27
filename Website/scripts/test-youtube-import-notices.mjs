import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/youtube-import-lease.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const listeners = new Map();
const channels = [];
const fakeWindow = {
  addEventListener(name, listener) { const entries = listeners.get(name) ?? new Set(); entries.add(listener); listeners.set(name, entries); },
  removeEventListener(name, listener) { listeners.get(name)?.delete(listener); }
};
class FakeBroadcastChannel {
  constructor(name) { this.name = name; this.onmessage = null; this.closed = false; channels.push(this); }
  close() { this.closed = true; }
  send(data) { this.onmessage?.({ data }); }
}
const noop = () => {};
const context = {
  exports: {}, window: fakeWindow, BroadcastChannel: FakeBroadcastChannel,
  require(name) {
    if (name === './youtube-import-checkpoints') return { YOUTUBE_IMPORT_PAGE_PREFIX: '', importPageKey: noop, importPagePrefix: noop, verifyYouTubeRefreshes: noop };
    if (name === './youtube-catalog-storage') return { planCatalogCommit: noop, VIDEO_WRITE_BATCH_SIZE: 100, videoRecordRange: noop };
    if (name === './background-work') return { forEachBackground: noop, yieldBackground: noop };
    throw Error(`Unexpected module ${name}`);
  }
};
runInNewContext(code, context);
const { subscribeYouTubeImportChanges } = context.exports;
const dispatchStorage = value => { for (const listener of listeners.get('storage') ?? []) listener({ key: 'learned-media-youtube-import-notice-v1', newValue: value }); };

let changes = 0;
const unsubscribe = subscribeYouTubeImportChanges(() => { changes += 1; });
const channel = channels.at(-1);
channel.send('notice-one');
dispatchStorage('notice-one');
dispatchStorage('notice-two');
channel.send('notice-two');
dispatchStorage(null);
assert.equal(changes, 2, 'the same notice from both transports is delivered once');
unsubscribe();
assert.equal(channel.closed, true);
assert.equal(listeners.get('storage')?.size, 0);

changes = 0;
const unsubscribeBounded = subscribeYouTubeImportChanges(() => { changes += 1; });
const boundedChannel = channels.at(-1);
for (let index = 0; index < 65; index += 1) boundedChannel.send(`notice-${index}`);
boundedChannel.send('notice-0');
assert.equal(changes, 66, 'the deduper retains only its most recent 64 IDs');
unsubscribeBounded();
console.log('Cross-tab import notices are deduplicated across transports with a bounded recent-ID set.');
