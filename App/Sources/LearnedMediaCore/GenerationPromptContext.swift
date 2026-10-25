import Foundation

/// Immutable per-operation context; never shared between queued generations.
public struct GenerationPromptContext {
    public let surpriseMe: Bool
    public let rabbitHole: String?
    public let factAngle: FactAngle
    public init(surpriseMe: Bool = false, rabbitHole: String? = nil, factAngle: FactAngle = .varied) {
        self.surpriseMe = surpriseMe
        self.factAngle = factAngle
        let value = rabbitHole?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.rabbitHole = value?.isEmpty == false ? String(value!.prefix(500)) : nil
    }
    public var factAngleRule: String { factAngle.instruction }
    public var factAngleField: PromptField { PromptField("Fact angle", factAngle.label) }
    public var surpriseModeField: PromptField { PromptField("Surprise mode", surpriseMe ? "Choose a surprising example within the selected fact angle and assigned topic." : nil) }
    public var threadContextField: PromptField { PromptField("Optional thread context", rabbitHole) }
    public var fields: [PromptField] {
        [factAngleField,
         surpriseModeField,
         threadContextField]
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
