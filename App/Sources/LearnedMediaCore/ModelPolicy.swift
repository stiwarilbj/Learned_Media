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
