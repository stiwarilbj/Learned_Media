import Foundation

public enum GeminiModelPolicy {
    public static let allowedModels: [String] = [
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite",
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite"
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
}
