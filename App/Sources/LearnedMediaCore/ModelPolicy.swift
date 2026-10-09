import Foundation

public enum GeminiModelPolicy {
    public static let requiredWorkingModels = 2
    public static let primaryModels = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
    public static let allowedModels: [String] = [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3-flash-preview",
        "gemini-2.5-flash"
    ]

    public static func isEligible(id: String, methods: [String]) -> Bool {
        let value = normalize(id)
        return methods.contains("generateContent") && allowedModels.contains(value)
    }

    public static func sort(_ models: [String]) -> [String] {
        let available = Set(models.map(normalize))
        return allowedModels.filter { available.contains($0) }
    }

    public static func normalize(_ id: String) -> String {
        id.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "^models/", with: "", options: .regularExpression)
            .lowercased()
    }

    public static func attemptRounds(models: [String], recover: Bool = true) -> [[String]] {
        let initial = sort(models)
        guard recover else { return [initial] }
        let primaries = primaryModels.filter { initial.contains($0) }
        let others = initial.filter { !primaryModels.contains($0) }
        let recovery = Array(repeating: primaries, count: 3).flatMap { $0 } + others
        return [initial, recovery, recovery]
    }
}

public enum GeminiRetryTiming {
    public static func transientDelay(failureCount: Int, retryAfter: TimeInterval = 0) -> TimeInterval {
        let steps: [TimeInterval] = [2, 4, 8]
        let index = min(max(0, failureCount - 1), steps.count - 1)
        return max(steps[index], retryAfter)
    }
}

public final class JSONArrayItemStreamParser {
    private enum Container { case object, array }
    private let property: String
    private var buffer: [Character] = []
    private var cursor = 0
    private var stack: [Container] = []
    private var inString = false
    private var escaped = false
    private var stringStart: Int?
    private var rootKey: String?
    private var pendingRootKey: String?
    private var arrayDepth = 0
    private var itemStart: Int?

    public init(property: String) { self.property = property }

    public func reset() {
        buffer.removeAll(keepingCapacity: true)
        cursor = 0
        stack.removeAll(keepingCapacity: true)
        inString = false
        escaped = false
        stringStart = nil
        rootKey = nil
        pendingRootKey = nil
        arrayDepth = 0
        itemStart = nil
    }

    public func append(_ fragment: String) -> [[String: Any]] {
        buffer.append(contentsOf: fragment)
        var items: [[String: Any]] = []
        while cursor < buffer.count {
            let index = cursor
            cursor += 1
            let character = buffer[index]
            if inString {
                if escaped { escaped = false }
                else if character == "\\" { escaped = true }
                else if character == "\"" {
                    inString = false
                    if stack.count == 1, case .object = stack[0], arrayDepth == 0, let start = stringStart {
                        let raw = String(buffer[start...index])
                        rootKey = try? JSONDecoder().decode(String.self, from: Data(raw.utf8))
                    }
                }
                continue
            }
            if character == "\"" {
                inString = true
                stringStart = index
                continue
            }
            if character.isWhitespace { continue }
            if character == ":", stack.count == 1, case .object = stack[0], arrayDepth == 0 {
                pendingRootKey = rootKey
                rootKey = nil
                continue
            }
            if character == "{" || character == "[" {
                if character == "[", pendingRootKey == property, stack.count == 1, case .object = stack[0] {
                    arrayDepth = stack.count + 1
                    pendingRootKey = nil
                }
                if arrayDepth > 0, character == "{", stack.count == arrayDepth { itemStart = index }
                stack.append(character == "{" ? .object : .array)
                continue
            }
            if character == "}" || character == "]" {
                guard let last = stack.last,
                      (character == "}" && { if case .object = last { return true }; return false }()) ||
                      (character == "]" && { if case .array = last { return true }; return false }()) else { continue }
                stack.removeLast()
                if character == "}", arrayDepth > 0, stack.count == arrayDepth, let start = itemStart {
                    let raw = String(buffer[start...index])
                    if let data = raw.data(using: .utf8), let value = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] { items.append(value) }
                    itemStart = nil
                }
                if character == "]", arrayDepth > 0, stack.count + 1 == arrayDepth { arrayDepth = 0 }
                continue
            }
            if character == ",", stack.count == 1, case .object = stack[0], arrayDepth == 0 {
                rootKey = nil
                pendingRootKey = nil
            }
        }
        return items
    }
}
