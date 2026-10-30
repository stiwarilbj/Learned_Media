import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = new URL("../../", import.meta.url);
const directory = mkdtempSync(path.join(tmpdir(), "learned-video-catalog-store-"));
const binary = path.join(directory, "test-video-catalog-store");

try {
  writeFileSync(path.join(directory, "Harness.swift"), `
import Foundation

func jsonClone(_ value: [String: Any]) throws -> [String: Any] {
    let bytes = try JSONSerialization.data(withJSONObject: value)
    return try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
}

func oldSameRecord(_ left: [String: Any], _ right: [String: Any]) -> Bool {
    let lhs = left.filter { $0.key != "metadataRefreshedAt" }
    let rhs = right.filter { $0.key != "metadataRefreshedAt" }
    return NSDictionary(dictionary: lhs).isEqual(to: rhs)
}

@main struct VideoCatalogStoreComparisonTest {
    static func main() async throws {
        let support = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        let library = support.appendingPathComponent("Learned Media", isDirectory: true)
        let batchFolder = library.appendingPathComponent("youtube-records-v1", isDirectory: true)
        let store = VideoCatalogStore(applicationSupportRoot: support)

        func batchReference() throws -> String {
            let bytes = try Data(contentsOf: library.appendingPathComponent("youtube-catalog-manifest-v1.json"))
            let manifest = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
            return (manifest["entries"] as! [[String]])[0][1]
        }
        func batchFileCount() throws -> Int {
            try FileManager.default.contentsOfDirectory(at: batchFolder, includingPropertiesForKeys: nil)
                .filter { $0.pathExtension == "json" }.count
        }
        func requireBatch(reference expected: String? = nil, differentFrom previous: String? = nil, fileCount expectedCount: Int) throws {
            let actualReference = try batchReference()
            let actualCount = try batchFileCount()
            if let expected { precondition(actualReference == expected, "Unexpected batch reference: \\(actualReference)") }
            if let previous { precondition(actualReference != previous, "The changed record reused its previous batch") }
            precondition(actualCount == expectedCount, "Unexpected batch file count: \\(actualCount)")
        }
        func catalog(_ video: [String: Any]) -> [String: Any] { ["catalogVersion": 1, "videos": [video]] }
        func save(_ video: [String: Any]) async throws { try await store.save(catalog(video)) }

        let nestedOriginal = try jsonClone([
            "numbers": [NSNumber(value: 1), NSNumber(value: 1.5)],
            "flags": [NSNumber(value: true), NSNumber(value: false)],
            "nested": ["integer": NSNumber(value: 1), "enabled": NSNumber(value: true)]
        ])
        let original: [String: Any] = [
            "id": "video-1", "title": "Stable title", "description": "Full description",
            "tags": ["science", "history"], "metadataRefreshedAt": 100,
            "metadata": nestedOriginal
        ]
        try await save(original)
        let originalReference = try batchReference()
        try requireBatch(fileCount: 1)

        let unchanged = try jsonClone(original)
        precondition(oldSameRecord(original, unchanged), "The old Foundation comparison should accept an unchanged nested record")
        try await save(unchanged)
        try requireBatch(reference: originalReference, fileCount: 1)

        var timestampOnly = unchanged
        timestampOnly["metadataRefreshedAt"] = 200
        precondition(oldSameRecord(unchanged, timestampOnly), "Timestamp-only changes remain ignored")
        try await save(timestampOnly)
        try requireBatch(reference: originalReference, fileCount: 1)

        var equivalentNumbers = timestampOnly
        equivalentNumbers["metadataRefreshedAt"] = 300
        equivalentNumbers["metadata"] = try jsonClone([
            "numbers": [NSNumber(value: 1.0), NSNumber(value: 1.5)],
            "flags": [true, false],
            "nested": ["integer": NSNumber(value: 1.0), "enabled": true]
        ])
        precondition(oldSameRecord(timestampOnly, equivalentNumbers), "Nested Foundation number and boolean equality remains unchanged")
        try await save(equivalentNumbers)
        try requireBatch(reference: originalReference, fileCount: 1)

        var missingProperty = equivalentNumbers
        missingProperty.removeValue(forKey: "tags")
        precondition(!oldSameRecord(equivalentNumbers, missingProperty), "Missing properties remain a record change")
        try await save(missingProperty)
        let missingReference = try batchReference()
        precondition(missingReference != originalReference, "Missing properties rewrite the batch")
        try requireBatch(reference: missingReference, fileCount: 2)

        var nestedChange = missingProperty
        nestedChange["metadataRefreshedAt"] = 400
        var metadata = nestedChange["metadata"] as! [String: Any]
        var nested = metadata["nested"] as! [String: Any]
        nested["enabled"] = false
        metadata["nested"] = nested
        nestedChange["metadata"] = metadata
        precondition(!oldSameRecord(missingProperty, nestedChange), "A nested metadata change remains significant")
        try await save(nestedChange)
        try requireBatch(differentFrom: missingReference, fileCount: 2)

        print("Native video catalog comparison: unchanged, timestamp-only, Foundation-equal nested values, missing keys, nested changes, and batch reuse/rewrite behavior passed")
    }
}
`);
  execFileSync("swiftc", [
    "-parse-as-library",
    new URL("App/Sources/LearnedMediaApp/VideoCatalogStore.swift", root).pathname,
    path.join(directory, "Harness.swift"),
    "-o", binary
  ], { stdio: "inherit" });
  execFileSync(binary, [directory], { stdio: "inherit" });
} finally {
  rmSync(directory, { recursive: true, force: true });
}
