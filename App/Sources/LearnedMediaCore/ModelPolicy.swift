import Foundation

public enum GeminiModelPolicy {
    public static func isEligible(id: String, methods: [String]) -> Bool {
        let value = id.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !value.isEmpty, methods.contains("generateContent") else { return false }
        return value.range(of: "image|imagen|video|veo|audio|embedding|embed|live|realtime|speech|tts|lyria|robotics", options: .regularExpression) == nil
    }

    public static func sort(_ models: [String]) -> [String] {
        Array(Set(models)).sorted { left, right in
            func rank(_ model: String) -> Int {
                let value = model.lowercased()
                if value.contains("flash") { return value.contains("lite") ? 1 : 0 }
                if value.contains("pro") { return 2 }
                return 3
            }
            let leftRank = rank(left)
            let rightRank = rank(right)
            return leftRank == rightRank ? left > right : leftRank < rightRank
        }
    }
}
