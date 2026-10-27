// Run the real LocalWorkspaceStore in separate OS processes and isolated folders.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = new URL('../../', import.meta.url);
const source = readFileSync(new URL('App/Sources/LearnedMediaApp/main.swift', root), 'utf8');
const start = source.indexOf('private final class LocalWorkspaceStore {');
let store = source.slice(start, source.indexOf('\nprivate final class WikipediaClient:', start));
const base = 'let base = try fileManager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)';
assert.ok(store.includes(base));
store = store.replace(base, 'let base = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)');
const read = 'let startingBytes = try snapshotBytes(at: locations.primary)';
const backup = 'if let previous { try previous.bytes.write(to: locations.backup, options: [.atomic]) }';
assert.ok(store.includes(read) && store.includes(backup));
// Test-only scheduling hooks; production code has no test callbacks or delays.
store = store.replace(read, read + '\n            try TestHooks.afterRead?(locations.primary)')
  .replace(backup, backup + '\n            try TestHooks.afterBackup?(locations.primary)');
const dir = mkdtempSync(path.join(tmpdir(), 'learned-snapshot-lock-'));
const binary = path.join(dir, 'test');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) { const end = Date.now() + 10000; while (!check()) { if (Date.now() > end) throw Error('Snapshot process barrier timed out'); await pause(10); } }
const children = new Set();
function launch(mode, folder, version) {
  const child = spawn(binary, [mode, folder, String(version)], { stdio: ['ignore', 'pipe', 'pipe'] }); children.add(child);
  let output = ''; child.stdout.on('data', x => output += x); child.stderr.on('data', x => output += x);
  const done = new Promise((resolve,reject) => { child.once('error',reject); child.once('exit',(code,signal) => { children.delete(child); resolve({code,signal,output}); }); });
  return { child, done };
}
async function run(mode, folder, version, expected = 0) { const result = await launch(mode,folder,version).done; assert.equal(result.code,expected,result.output); }
const files = folder => ({ primary:path.join(folder,'Learned Media','learning-state.json'), backup:path.join(folder,'Learned Media','learning-state.json.backup'), lock:path.join(folder,'Learned Media','learning-state.json.lock') });
const versionAt = file => JSON.parse(readFileSync(file,'utf8')).workspaces[0].name;
try {
 writeFileSync(path.join(dir,'Harness.swift'), `
import Foundation
import Darwin
struct NativeError: Error { let message: String; var retryable = true }
enum TestHooks {
 static var afterRead: ((URL) throws -> Void)?
 static var afterBackup: ((URL) throws -> Void)?
}
${store}
@main struct Runner {
 static func snapshot(_ version: String) -> [String: Any] {
  ["persistenceVersion": 2,"activeWorkspaceId":"w","workspaces":[["id":"w","name":version,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-02T00:00:00Z","state":["topics":[],"cards":[],"settings":["obscurity":5,"sentenceLength":3,"displayMode":"text"]]]]]
 }
 static func main() {
  let mode=CommandLine.arguments[1], folder=URL(fileURLWithPath:CommandLine.arguments[2]), version=CommandLine.arguments[3]
  let marker=folder.appendingPathComponent("entered-"+version), release=folder.appendingPathComponent("release-"+version)
  let external = try! JSONSerialization.data(withJSONObject:snapshot("external"),options:[.prettyPrinted,.sortedKeys])
  TestHooks.afterRead = { primary in
   try Data().write(to:marker)
   if mode == "hold" { while !FileManager.default.fileExists(atPath:release.path) { Thread.sleep(forTimeInterval:0.005) } }
   if mode == "external-before" { try external.write(to:primary,options:.atomic) }
  }
  if mode == "external-after" { TestHooks.afterBackup = { primary in try external.write(to:primary,options:.atomic) } }
  do {
   try Data().write(to:folder.appendingPathComponent("attempt-"+version))
   let store = LocalWorkspaceStore()
   if mode == "recover" {
    do { try store.save(snapshot(version)); fatalError("Expected backup write failure") } catch {}
    let backup=folder.appendingPathComponent("Learned Media/learning-state.json.backup")
    try FileManager.default.removeItem(at:backup)
    try store.save(snapshot(version))
   } else { try store.save(mode == "invalid" ? ["invalid":true] : snapshot(version)) }
  } catch { fputs("SAVE_FAILED\\n",stderr); exit(1) }
 }
}
`);
 execFileSync('swiftc',['-parse-as-library',new URL('App/Sources/LearnedMediaCore/SnapshotValidation.swift',root).pathname,path.join(dir,'Harness.swift'),'-o',binary],{stdio:'inherit'});
 for (const seeded of [false,true]) {
  const folder=path.join(dir,seeded?'overlap':'initial'); mkdirSync(folder);
  if(seeded) await run('save',folder,0);
  const a=launch('hold',folder,1); await until(()=>existsSync(path.join(folder,'entered-1')));
  const inode=statSync(files(folder).lock).ino;
  const b=launch('save',folder,2); await until(()=>existsSync(path.join(folder,'attempt-2'))); await pause(100);
  assert.equal(existsSync(path.join(folder,'entered-2')),false,'second process cannot read the primary until the owner releases it');
  writeFileSync(path.join(folder,'release-1'),'');
  assert.equal((await a.done).code,0); assert.equal((await b.done).code,0);
  assert.equal(versionAt(files(folder).primary),'2'); assert.equal(versionAt(files(folder).backup),'1');
  assert.equal(statSync(files(folder).lock).ino,inode,'atomic replacement must not replace or unlink the coordination inode');
 }
 const killed=path.join(dir,'killed'); mkdirSync(killed); await run('save',killed,0);
 const owner=launch('hold',killed,1); await until(()=>existsSync(path.join(killed,'entered-1')));
 const waiter=launch('save',killed,2); await until(()=>existsSync(path.join(killed,'attempt-2')));
 owner.child.kill('SIGKILL'); await owner.done; assert.equal((await waiter.done).code,0);
 assert.equal(versionAt(files(killed).backup),'0'); assert.equal(versionAt(files(killed).primary),'2');
 for(const mode of ['external-before','external-after']) {
  const folder=path.join(dir,mode); mkdirSync(folder); await run('save',folder,-1); await run('save',folder,0);
  const before=readFileSync(files(folder).primary);
  const older=readFileSync(files(folder).backup);
  await run(mode,folder,1,1);
  assert.equal(versionAt(files(folder).primary),'external','an uncoordinated change must not be overwritten');
  assert.deepEqual(readFileSync(files(folder).backup),mode==='external-before'?older:before);
 }
 const failure=path.join(dir,'failure'); mkdirSync(failure); await run('save',failure,0);
 mkdirSync(files(failure).backup); await run('recover',failure,1);
 assert.equal(versionAt(files(failure).primary),'1'); assert.equal(versionAt(files(failure).backup),'0');
 const invalid=path.join(dir,'invalid'); mkdirSync(invalid); await run('invalid',invalid,0,1);
 assert.equal(existsSync(files(invalid).primary),false); assert.equal(existsSync(files(invalid).lock),false);
 const corrupt=path.join(dir,'corrupt'); mkdirSync(corrupt); await run('save',corrupt,0); await run('save',corrupt,1);
 const validBackup=readFileSync(files(corrupt).backup); writeFileSync(files(corrupt).primary,'{broken');
 await run('save',corrupt,2); assert.deepEqual(readFileSync(files(corrupt).backup),validBackup); assert.equal(versionAt(files(corrupt).primary),'2');
 const inaccessible=path.join(dir,'inaccessible'); mkdirSync(inaccessible); await run('save',inaccessible,0);
 const original=readFileSync(files(inaccessible).primary);
 rmSync(files(inaccessible).lock); mkdirSync(files(inaccessible).lock);
 await run('save',inaccessible,1,1); assert.deepEqual(readFileSync(files(inaccessible).primary),original);
 rmSync(files(inaccessible).lock,{recursive:true}); await run('save',inaccessible,1);
 const unreadable=path.join(dir,'unreadable'); mkdirSync(unreadable); await run('save',unreadable,0); await run('save',unreadable,1);
 const recovery=readFileSync(files(unreadable).backup);
 rmSync(files(unreadable).primary); mkdirSync(files(unreadable).primary);
 await run('save',unreadable,2,1); assert.deepEqual(readFileSync(files(unreadable).backup),recovery);
 console.log('Native snapshot coordination: concurrent first/existing saves, exact backup bytes, persistent locks, process death, revision conflicts, write failures and invalid recovery passed');
} finally { for(const child of children) child.kill('SIGKILL'); rmSync(dir,{recursive:true,force:true}); }
