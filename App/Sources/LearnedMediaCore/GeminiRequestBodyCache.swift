import Foundation

/// Operation-scoped serialized request bodies for Gemini model fallback.
/// The prompt and schema are fixed for the lifetime of this value; output
/// capacity is the only request-body field that can change between attempts.
public struct GeminiRequestBodyCache {
    private let prompt: String
    private let schema: [String: Any]
    private let temperature: Double
    private var bodies: [Int: Data] = [:]

    public init(prompt: String, schema: [String: Any], temperature: Double) {
        self.prompt = prompt
        self.schema = schema
        self.temperature = temperature
    }

    public var cachedBodyCount: Int { bodies.count }

    public mutating func body(maxOutputTokens: Int) throws -> Data {
        let capacity = Self.clampedCapacity(maxOutputTokens)
        if let cached = bodies[capacity] { return cached }
        let serialized = try Self.serialize(prompt: prompt, schema: schema, maxOutputTokens: capacity, temperature: temperature)
        bodies[capacity] = serialized
        return serialized
    }

    public static func serialize(prompt: String, schema: [String: Any], maxOutputTokens: Int, temperature: Double) throws -> Data {
        try JSONSerialization.data(withJSONObject: [
            "contents": [["role": "user", "parts": [["text": prompt]]]],
            "generationConfig": [
                "temperature": temperature,
                "maxOutputTokens": clampedCapacity(maxOutputTokens),
                "responseMimeType": "application/json",
                "responseSchema": schema
            ]
        ])
    }

    private static func clampedCapacity(_ value: Int) -> Int {
        max(128, min(value, 65_536))
    }
}
