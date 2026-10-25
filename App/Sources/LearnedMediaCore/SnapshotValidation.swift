import Foundation
import CoreFoundation

/// Fixed failure codes/counts only; no saved content or account identifiers.
public enum SnapshotValidation {
    public enum Kind: String { case state, record, memory, nativeStore = "native-store" }
    public enum Operation: String { case read, save, `import`, backup }
    private static let lock = NSLock()
    private static var failures: [String: Int] = [:]

    private static func object(_ value: Any?) -> [String: Any]? { value as? [String: Any] }
    private static func text(_ value: Any?) -> Bool { (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false }
    private static func strings(_ value: Any?) -> Bool { value is [String] }
    private static func number(_ value: Any?) -> Bool {
        guard let value = value as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID() else { return false }
        return value.doubleValue.isFinite
    }
    private static func integer(_ value: Any?) -> Bool {
        guard number(value), let value = value as? NSNumber else { return false }
        return value.doubleValue.rounded(.towardZero) == value.doubleValue
    }
    private static func boolean(_ value: Any?) -> Bool {
        guard let value = value as? NSNumber else { return false }
        return CFGetTypeID(value) == CFBooleanGetTypeID()
    }
    private static func optional(_ value: Any?, _ check: (Any?) -> Bool) -> Bool { value == nil || value is NSNull || check(value) }
    private static let fractionalDate: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return formatter
    }()
    private static let plainDate = ISO8601DateFormatter()
    private static func date(_ value: Any?) -> Bool {
        guard let value = value as? String else { return false }
        return fractionalDate.date(from: value) != nil || plainDate.date(from: value) != nil
    }
    private static func version(_ value: Any?) -> Bool {
        guard let value else { return true } // Supported legacy layout.
        guard number(value), let value = value as? NSNumber else { return false }
        return value.doubleValue.rounded() == value.doubleValue && (0...3).contains(value.intValue)
    }
    private static func topics(_ value: Any?) -> Bool {
        if let compact = object(value) {
            guard compact["format"] as? String == "learned-media-topic-preferences-v1", strings(compact["selected"]), strings(compact["expanded"]),
                  let weights = object(compact["weights"]), weights.values.allSatisfy(number), compact["custom"] is [Any] else { return false }
            return topics(compact["custom"])
        }
        guard var pending = value as? [Any] else { return false }
        var index = 0, ids = Set<String>()
        while index < pending.count {
            guard let node = object(pending[index]), let id = node["id"] as? String, text(id), ids.insert(id).inserted, text(node["label"]),
                  optional(node["selected"], boolean), optional(node["expanded"], boolean), optional(node["weight"], number), optional(node["aliases"], strings) else { return false }
            if let children = node["children"], !(children is NSNull) {
                guard let children = children as? [Any] else { return false }
                pending.append(contentsOf: children)
            }
            index += 1
        }
        return true
    }
    private static func source(_ raw: Any?) -> Bool {
        guard let value = object(raw) else { return false }
        return text(value["title"]) && text(value["url"]) && ["canonicalUrl", "extract"].allSatisfy { optional(value[$0], { $0 is String }) }
    }
    private static let resolvedAnswerStructures: Set<String> = ["short-explanation", "ordered-steps", "side-by-side-comparison"]
    private static func answerPresentation(_ raw: Any?) -> Bool {
        guard let value = object(raw), text(value["directAnswer"]), let structure = value["structure"] as? String,
              resolvedAnswerStructures.contains(structure), optional(value["fallbackReason"], { (($0 as? String)?.count ?? 0) <= 300 }) else { return false }
        if structure == "ordered-steps" {
            guard let steps = value["steps"] as? [String], (2...10).contains(steps.count) else { return false }
            return steps.allSatisfy { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        }
        if structure == "side-by-side-comparison" {
            guard let subjects = value["comparisonSubjects"] as? [String], subjects.count == 2,
                  subjects.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }),
                  subjects[0].localizedCaseInsensitiveCompare(subjects[1]) != .orderedSame,
                  let rows = value["comparisonRows"] as? [[String: Any]], (1...10).contains(rows.count) else { return false }
            return rows.allSatisfy { row in
                guard text(row["property"]), let values = row["values"] as? [String], values.count == 2 else { return false }
                return values.allSatisfy { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            }
        }
        return optional(value["paragraphs"], { raw in
            guard let paragraphs = raw as? [String], paragraphs.count <= 8 else { return false }
            return paragraphs.allSatisfy { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        })
    }
    private static func cards(_ value: Any?) -> Bool {
        guard let values = value as? [Any] else { return false }
        var ids = Set<String>()
        return values.allSatisfy { value in
            guard let card = object(value), let id = card["id"] as? String, text(id), ids.insert(id).inserted,
                  text(card["title"]), text(card["body"]), optional(card["hook"], { $0 is String }),
                  let path = card["topicPath"] as? [String], !path.isEmpty, let sources = card["sources"] as? [[String: Any]], !sources.isEmpty else { return false }
            guard sources.allSatisfy(source), ["claim", "learnMore", "question", "answer"].allSatisfy({ optional(card[$0], { $0 is String }) }),
                  ["liked", "saved", "known", "moreLike", "lessLike", "surprise", "questionDetailed", "answerDetailed"].allSatisfy({ optional(card[$0], boolean) }),
                  ["sentenceCount", "difficulty", "obscurity"].allSatisfy({ optional(card[$0], number) }), optional(card["createdAt"], { $0 is String }),
                  optional(card["answerSources"], { ($0 as? [Any])?.allSatisfy(source) == true }),
                  optional(card["answerStructure"], { resolvedAnswerStructures.contains($0 as? String ?? "") }),
                  optional(card["answerPresentation"], answerPresentation),
                  optional(card["learnMoreSources"], { ($0 as? [Any])?.allSatisfy(source) == true }),
                  optional(card["chronology"], { raw in
                      guard let chronology = object(raw), let fingerprint = chronology["fingerprint"] as? String,
                            fingerprint.range(of: "^[a-f0-9]{16}$", options: .regularExpression) != nil,
                            let events = chronology["events"] as? [[String: Any]], events.count <= 12 else { return false }
                      return events.allSatisfy { event in
                          guard text(event["dateText"]), text(event["eventText"]), let anchor = object(event["anchor"]),
                                ["title", "hook", "body"].contains(anchor["field"] as? String ?? "") else { return false }
                          return optional(anchor["sentenceIndex"], integer)
                      }
                  }),
                  optional(card["questionHistory"], { raw in
                      (raw as? [[String: Any]])?.allSatisfy { ["user", "assistant"].contains($0["role"] as? String ?? "") && $0["content"] is String } == true
                  }), optional(card["evidence"], { raw in
                      (raw as? [[String: Any]])?.allSatisfy { number($0["sentence"]) && number($0["sourceIndex"]) && $0["quote"] is String && optional($0["section"], { $0 is String }) } == true
                  }), optional(card["image"], { raw in
                      guard let image = object(raw), text(image["url"]) else { return false }
                      return ["alt", "sourceTitle", "sourceUrl", "fileUrl", "filePageUrl", "credit"].allSatisfy { optional(image[$0], { $0 is String }) }
                  }) else { return false }
            return true
        }
    }
    private static func memory(_ value: Any?) -> Bool {
        guard let memory = value as? [[String: Any]] else { return false }
        return memory.allSatisfy { text($0["id"]) && text($0["title"]) && text($0["body"])
            && optional($0["topicPath"], strings) && optional($0["sourceUrls"], strings) && optional($0["evidence"], strings) }
    }
    private static func activity(_ value: Any?) -> Bool {
        guard let value = object(value), optional(value["savedIds"], strings), optional(value["discoverIds"], strings),
              ["searchText", "selectedTopic", "activeTab", "selectedChannelId", "selectedVideoId", "channelOrder", "topic", "tab", "order"].allSatisfy({ optional(value[$0], { $0 is String }) }),
              optional(value["smartIds"], strings), optional(value["smartReasons"], { ($0 as? [String: String]) != nil }),
              optional(value["prioritizeRecentByChannel"], { raw in object(raw)?.values.allSatisfy(boolean) == true }) else { return false }
        if let history = value["history"], !(history is NSNull) {
            guard let history = history as? [[String: Any]], history.allSatisfy({ text($0["videoId"]) && date($0["watchedAt"]) }) else { return false }
        }
        if let positions = value["playbackPositions"], !(positions is NSNull) {
            guard let positions = object(positions), positions.values.allSatisfy({ number($0) && ($0 as! NSNumber).doubleValue >= 0 }) else { return false }
        }
        return true
    }
    private static func stateFailure(_ raw: Any?) -> String? {
        guard let value = object(raw) else { return "structure" }
        guard version(value["persistenceVersion"]) else { return "version" }
        guard topics(value["topics"]) else { return "topics" }
        guard cards(value["cards"]) else { return "cards" }
        guard let settings = object(value["settings"]) else { return "fields" }
        if (value["persistenceVersion"] as? Int ?? 0) >= 2 && (!number(settings["obscurity"]) || !text(settings["displayMode"]) || !number(settings["sentenceLength"])) { return "fields" }
        guard optional(settings["obscurity"], number), optional(settings["sentenceLength"], number), optional(settings["surpriseMe"], boolean),
              optional(settings["displayMode"], { ["text", "picture-text"].contains($0 as? String ?? "") }),
              optional(value["theme"], { ["light", "dark"].contains($0 as? String ?? "") }), optional(value["savedAt"], date),
              optional(value["feedStarted"], boolean), optional(value["started"], boolean) else { return "fields" }
        for field in ["learningProfile", "profile"] {
            if let profile = value[field], !(profile is NSNull) {
                guard let profile = object(profile), profile.values.allSatisfy({ raw in
                    guard let item = object(raw) else { return false }
                    return ["heard", "unknown", "unknownStreak", "targetDifficulty"].allSatisfy { optional(item[$0], number) }
                }) else { return "fields" }
            }
        }
        if let activityValue = value["youtubeActivity"], !(activityValue is NSNull), !activity(activityValue) { return "activity" }
        return nil
    }
    private static func recordFailure(_ raw: Any?) -> String? {
        guard let value = object(raw), text(value["id"]), text(value["name"]), date(value["createdAt"]), date(value["updatedAt"]) else { return "fields" }
        return stateFailure(value["state"])
    }
    private static func failure(_ raw: Any?, _ kind: Kind) -> String? {
        if kind == .memory { return memory(raw) ? nil : "memory" }
        if kind == .state { return stateFailure(raw) }
        if kind == .record { return recordFailure(raw) }
        guard let value = object(raw) else { return "structure" }
        guard version(value["persistenceVersion"]) else { return "version" }
        guard value["workspaces"] != nil else { return stateFailure(value) }
        guard let records = value["workspaces"] as? [[String: Any]], !records.isEmpty, let activeID = value["activeWorkspaceId"] as? String else { return "fields" }
        var ids = Set<String>()
        for record in records {
            if let failure = recordFailure(record) { return failure }
            guard let id = record["id"] as? String, ids.insert(id).inserted else { return "fields" }
        }
        guard ids.contains(activeID), optional(value["theme"], { ["light", "dark"].contains($0 as? String ?? "") }) else { return "fields" }
        if let memory = value["factMemory"], !(memory is NSNull) {
            guard self.memory(memory) else { return "memory" }
        }
        return nil
    }
    public static func validate(_ value: Any?, kind: Kind, operation: Operation) -> Bool {
        guard let issue = failure(value, kind) else { return true }
        record(kind, operation, issue); return false
    }
    public static func recordInvalidJSON(kind: Kind, operation: Operation) { record(kind, operation, "json") }
    private static func record(_ kind: Kind, _ operation: Operation, _ issue: String) {
        lock.lock(); defer { lock.unlock() }
        let key = "\(operation.rawValue).\(kind.rawValue).\(issue)"
        failures[key] = min(9_007_199_254_740_991, (failures[key] ?? 0) + 1)
    }
    public static func snapshot() -> [String: Any] { lock.lock(); defer { lock.unlock() }; return ["version": 1, "failures": failures] }
    public static func reset() { lock.lock(); defer { lock.unlock() }; failures.removeAll(keepingCapacity: true) }
}
