// Compile the actual native restoration methods with an isolated transport.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = new URL('../../', import.meta.url);
const source = readFileSync(new URL('App/Sources/LearnedMediaApp/main.swift', root), 'utf8');
const methods = source.slice(source.indexOf('    private func cloudMemoryPage('), source.indexOf('    private let cloudSecretKeys:'));
const dir = mkdtempSync(path.join(tmpdir(), 'learned-cursor-test-'));
try {
 writeFileSync(path.join(dir, 'Harness.swift'), `
import Foundation
struct NativeError: Error { let message: String; var retryable = true }
struct CloudSession { let userID: String }
final class Harness {
 var sessionEpoch = 0
 var observedCloudRevisions: [String: [String: String]] = [:]
 var conflictingCloudRecords: [String: [String: [String: Any]]] = [:]
 var heads: [[String: Any]] = [], requests: [[URLQueryItem]] = []
 var mode = "normal"
 func cloudConfiguration() throws -> (URL, String) { (URL(string: "https://example.invalid")!, "test") }
 func cloudSession() async throws -> CloudSession { CloudSession(userID: "account") }
 func cloudRequest(_ url: URL, method: String, anonKey: String, session: CloudSession, body: Any? = nil) async throws -> Any {
  if url.lastPathComponent == "fact_memory" { return [[String: Any]]() }
  let items = URLComponents(url: url, resolvingAgainstBaseURL: false)!.queryItems ?? []
  requests.append(items)
  let after = items.first { $0.name == "workspace_id" && $0.value!.hasPrefix("gt.") }?.value.map { String($0.dropFirst(3)) }
  let through = items.first { $0.name == "workspace_id" && $0.value!.hasPrefix("lte.") }?.value.map { String($0.dropFirst(4)) }
  if after != nil {
   if mode == "error" { throw NativeError(message: "page failed") }
   if mode == "epoch" { sessionEpoch += 1 }
   if mode == "duplicate" { return [heads[0]] }
   if mode == "mismatch" { return [["workspace_id": "wrong", "revision_id": "wrong", "record": Self.record("different")]] }
   if mode == "concurrent" && after == "w-00099" {
    heads.append(Self.row("z-new"))
    heads[150] = Self.row("w-00150", revision: "new-revision")
   }
  }
  var rows = heads.filter { row in
   let id = row["workspace_id"] as! String
   return (after == nil || id > after!) && (through == nil || id <= through!)
  }.sorted { ($0["workspace_id"] as! String) < ($1["workspace_id"] as! String) }
  if items.contains(where: { $0.name == "order" && $0.value == "workspace_id.desc" }) { rows.reverse() }
  let limit = Int(items.first { $0.name == "limit" }!.value!)!
  rows = Array(rows.prefix(limit))
  if items.contains(where: { $0.name == "select" }) { return rows.map { ["workspace_id": $0["workspace_id"]!] } }
  return rows
 }
 static func record(_ id: String) -> [String: Any] {
  ["id": id, "name": "Workspace", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-10-26T12:00:00Z", "state": ["topics": [], "cards": [], "settings": ["obscurity": 5, "sentenceLength": 3, "displayMode": "text"]]]
 }
 static func row(_ id: String, revision: String = "revision") -> [String: Any] { ["workspace_id": id, "revision_id": revision, "record": record(id)] }
 init(_ count: Int) { heads = (0..<count).map { Self.row(String(format: "w-%05d", $0)) } }
 ${methods}
 func run() async throws -> [String: Any] { try await cloudLoad() }
}
@main struct Test {
 static func main() async throws {
  for count in [0, 1, 99, 100, 101, 200, 1105] {
   let h = Harness(count); if count == 1105 { h.mode = "concurrent" }
   let result = try await h.run(), records = result["records"] as! [[String: Any]]
   precondition(records.count == count)
   precondition(Set(records.map { $0["id"] as! String }).count == count)
   precondition(h.requests.count == 1 + (count + 99) / 100)
   for request in h.requests.dropFirst() {
    precondition(request.contains { $0.name == "workspace_id" && $0.value == String(format: "lte.w-%05d", count - 1) })
   }
   if count == 1105 { precondition(h.observedCloudRevisions["account"]?["w-00150"] == "new-revision") }
  }
  for mode in ["error", "duplicate", "epoch"] {
   let h = Harness(150); h.mode = mode
   do { _ = try await h.run(); fatalError("Invalid partial restore accepted: \\(mode)") } catch {}
   precondition(h.observedCloudRevisions.isEmpty)
  }
  for position in [0,75,149] {
   SnapshotValidation.reset()
   let h = Harness(150), id = String(format: "w-%05d", position)
   h.heads[position]["record"] = ["id": id, "name": "PRIVATE BAD PAYLOAD", "state": ["cards": "invalid"]]
   let result = try await h.run(), records = result["records"] as! [[String: Any]]
   precondition(records.count == 149 && !records.contains { $0["id"] as? String == id })
   precondition(h.observedCloudRevisions["account"]?[id] == "revision")
   precondition(h.conflictingCloudRecords["account"]?[id] == nil)
   let diagnostics = SnapshotValidation.snapshot()["failures"] as! [String: Int]
   precondition(diagnostics.values.reduce(0,+) == 1)
   precondition(!String(describing: diagnostics).contains("PRIVATE"))
  }
  let badPage = Harness(201)
  for index in 0..<100 { badPage.heads[index]["record"] = ["private": "DO NOT RETAIN"] }
  let recovered = try await badPage.run()
  precondition((recovered["records"] as! [[String: Any]]).count == 101 && badPage.requests.count == 4)
  let identity = Harness(3)
  identity.heads[0]["record"] = Harness.record("different")
  identity.heads[1].removeValue(forKey: "revision_id")
  let valid = try await identity.run()
  precondition((valid["records"] as! [[String: Any]]).count == 1)
  print("Native workspace cursor: page boundaries, large accounts, concurrent heads, failures, invalid pages and stale sessions passed")
 }
}
`);
 execFileSync('swiftc', ['-parse-as-library', new URL('App/Sources/LearnedMediaCore/SnapshotValidation.swift', root).pathname, path.join(dir, 'Harness.swift'), '-o', path.join(dir, 'test')], { stdio: 'inherit' });
 execFileSync(path.join(dir, 'test'), [], { stdio: 'inherit' });
} finally { rmSync(dir, { recursive: true, force: true }); }
