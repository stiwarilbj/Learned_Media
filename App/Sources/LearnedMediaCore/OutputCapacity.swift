import Foundation

public enum OutputCapacity {
    public static let maximum = 65_536
    public static func next(_ current: Int, finishReason: String? = nil) -> Int {
        let capacity = max(128, min(maximum, current))
        return finishReason == "MAX_TOKENS" ? min(maximum, capacity * 2) : capacity
    }
    public static func truncatedFloor(_ outcomes: [[String: Any]]) -> Int {
        outcomes.reduce(0) { floor, outcome in
            guard outcome["finishReason"] as? String == "MAX_TOKENS", let capacity = outcome["maxOutputTokens"] as? Int else { return floor }
            return max(floor, next(capacity, finishReason: "MAX_TOKENS"))
        }
    }
}
