import Foundation

/// Immutable per-operation context; never shared between queued generations.
public struct GenerationPromptContext {
    public let surpriseMe: Bool
    public let rabbitHole: String?
    public init(surpriseMe: Bool = false, rabbitHole: String? = nil) {
        self.surpriseMe = surpriseMe
        let value = rabbitHole?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.rabbitHole = value?.isEmpty == false ? String(value!.prefix(500)) : nil
    }
    public var fields: [PromptField] {
        [PromptField("Surprise mode", surpriseMe ? "Choose an unexpected angle within each assigned topic." : nil),
         PromptField("Optional thread context", rabbitHole)]
    }
}

public enum WorkspaceActivity {
    /// Canonical exchange keys, with legacy native aliases accepted on restoration.
    public static func canonicalized(_ input: [String: Any]) -> [String: Any] {
        var result = input
        for (canonical, legacy) in [("selectedTopic", "topic"), ("activeTab", "tab"), ("channelOrder", "order")] {
            if result[canonical] == nil { result[canonical] = result[legacy] }
            result.removeValue(forKey: legacy)
        }
        if let preferences = input["prioritizeRecentByChannel"] as? [String: Any] {
            result["prioritizeRecentByChannel"] = preferences.filter { $0.value is Bool }
        }
        return result
    }
}
