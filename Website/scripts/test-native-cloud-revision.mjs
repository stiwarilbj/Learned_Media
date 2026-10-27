// Exercise the actual native cloudSave controller with an isolated network double.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = new URL('../../', import.meta.url), source = readFileSync(new URL('App/Sources/LearnedMediaApp/main.swift', root), 'utf8');
function method(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
const save = method('    private func cloudSave(', '    private func youtubeResponseSchema(');
const hash = method('    private func workspaceRevisionID(', '    private func cloudSave(');
const decode = method('    private func decodedCloudWorkspace(', '    private func cloudWorkspaceRevisions(');
const dir = mkdtempSync(path.join(tmpdir(), 'learned-cloud-test-'));
try {
 writeFileSync(path.join(dir, 'Harness.swift'), `
import Foundation
import CryptoKit
struct NativeError: Error { let message: String; var retryable = true; var status: String? = nil }
struct CloudSession { let userID: String }
final class Server {
 var heads: [String: [String: Any]] = [:], accepted = Set<String>()
 var writes: [[[String: Any]]] = [], reads = 0
 var forceConflicts = 0, loseResponse = false, failMemory = false
}
final class Harness {
 let server: Server
 var sessionEpoch = 0
 var observedCloudRevisions: [String: [String: String]] = [:]
 var conflictingCloudRecords: [String: [String: [String: Any]]] = [:]
 init(_ server: Server) { self.server = server }
 func cloudConfiguration() throws -> (URL, String) { (URL(string: "https://example.invalid")!, "test") }
 func cloudSession() async throws -> CloudSession { CloudSession(userID: "account") }
 func cloudNow() -> String { "2026-01-01T00:00:00Z" }
 func cleanedCloudValue(_ value: Any) -> Any { value }
 func canonicalCloudRecord(_ value: [String: Any]) -> [String: Any] { value }
 func cloudRequest(_ url: URL, method: String, anonKey: String, session: CloudSession, body: Any, prefer: String = "") async throws -> Any {
  if url.lastPathComponent == "remember_facts" {
   if server.failMemory { server.failMemory = false; throw NativeError(message: "Memory upload failed") }
   return NSNull()
  }
  if url.lastPathComponent == "latest_workspace_revisions" { server.reads += 1; return Array(server.heads.values) }
  let rows = body as! [[String: Any]]; server.writes.append(rows)
  if server.forceConflicts > 0 { server.forceConflicts -= 1; throw NativeError(message: "conflict", status: "revision-conflict") }
  for row in rows {
   let id = row["workspace_id"] as! String, revision = row["revision_id"] as! String
   if !server.accepted.contains(revision) && (server.heads[id]?["revision_id"] as? String) != (row["expected_revision_id"] as? String) { throw NativeError(message: "conflict", status: "revision-conflict") }
  }
  for row in rows {
   let id = row["workspace_id"] as! String, revision = row["revision_id"] as! String
   if !server.accepted.contains(revision) { server.accepted.insert(revision); server.heads[id] = row }
  }
  if server.loseResponse { server.loseResponse = false; throw NativeError(message: "lost response") }
  return NSNull()
 }
 ${hash}
 ${decode}
 ${save}
 func run(_ record: [String: Any], owner: String = "account", memories: [[String: Any]] = []) async throws -> [String: Any] {
  try await cloudSave(["cloudOwnerId": owner, "activeWorkspaceId": "w", "workspaces": [record], "factMemory": memories])
 }
}
@main struct Test {
 static func record(_ time: Int) -> [String: Any] {
  ["id": "w", "name": "Workspace \\(time)", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-10-26T12:00:0\\(time).000Z", "state": ["topics": [], "cards": [], "settings": ["obscurity": 5, "sentenceLength": 3, "displayMode": "text"]]]
 }
 static func main() async throws {
  let db = Server(), a = Harness(db), b = Harness(db)
  _ = try await a.run(record(1)); let initial = db.heads["w"]!["revision_id"] as! String
  b.observedCloudRevisions = ["account": ["w": initial]]
  _ = try await a.run(record(4)); let latest = db.heads["w"]!["revision_id"] as! String
  let merged = try await b.run(record(2))
  precondition(db.heads["w"]!["revision_id"] as! String == latest)
  precondition((merged["mergedRecords"] as! [[String: Any]])[0]["name"] as! String == "Workspace 4")
  precondition(db.writes.last![0]["expected_revision_id"] as! String == latest)
  _ = try await b.run(record(3)); precondition(db.heads["w"]!["revision_id"] as! String == latest)
  _ = try await b.run(record(5)); precondition((db.heads["w"]!["record"] as! [String: Any])["name"] as! String == "Workspace 5")
  let deniedCount = db.writes.count
  do { _ = try await b.run(record(6), owner: "other"); fatalError("Account mismatch accepted") } catch {}
  precondition(db.writes.count == deniedCount)
  let lost = Server(), c = Harness(lost); lost.loseResponse = true
  do { _ = try await c.run(record(1)); fatalError("Expected lost response") } catch {}
  _ = try await c.run(record(1)); precondition(lost.writes[0][0]["revision_id"] as! String == lost.writes[1][0]["revision_id"] as! String)
  let memoryDB = Server(), writer = Harness(memoryDB), delayed = Harness(memoryDB)
  _ = try await writer.run(record(1)); delayed.observedCloudRevisions = ["account": ["w": memoryDB.heads["w"]!["revision_id"] as! String]]
  _ = try await writer.run(record(4)); memoryDB.failMemory = true
  let memories: [[String: Any]] = [["id": "fact", "title": "Fixture", "body": "Fixture fact."]]
  do { _ = try await delayed.run(record(2), memories: memories); fatalError("Expected memory failure") } catch {}
  let recovered = try await delayed.run(record(2), memories: memories)
  precondition((recovered["mergedRecords"] as! [[String: Any]])[0]["name"] as! String == "Workspace 4")
  let malformed = Server(), repair = Harness(malformed)
  malformed.heads["w"] = ["workspace_id": "w", "revision_id": "bad-head", "record": ["id": "w", "private": "DO NOT RETAIN"]]
  _ = try await repair.run(record(5))
  precondition((malformed.writes.last![0]["record"] as! [String: Any])["name"] as! String == "Workspace 5")
  precondition(repair.conflictingCloudRecords["account"]?["w"] == nil)
  let failing = Server(), d = Harness(failing); failing.forceConflicts = 3
  do { _ = try await d.run(record(1)); fatalError("Unbounded conflict accepted") } catch {}
  precondition(failing.writes.count == 3)
  print("Native cloud controller: unchanged writes, stale merge, newer edits, queued stale state, account isolation, idempotence and bounded recovery passed")
 }
}
`);
 execFileSync('swiftc', ['-parse-as-library', new URL('App/Sources/LearnedMediaCore/SnapshotValidation.swift', root).pathname, path.join(dir, 'Harness.swift'), '-o', path.join(dir, 'test')], { stdio: 'inherit' });
 execFileSync(path.join(dir, 'test'), [], { stdio: 'inherit' });
} finally { rmSync(dir, { recursive: true, force: true }); }
