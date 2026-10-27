import Foundation
import CoreFoundation

public enum StructuredResponse {
    /// Remove a BOM only at the response boundary, never inside JSON strings.
    public static func stripResponseBom(_ text: String) -> String {
        text.hasPrefix("\u{FEFF}") ? String(text.dropFirst()) : text
    }

    // JSONSerialization drops a leading U+FEFF inside string values on macOS.
    // JSONDecoder preserves those characters, including escaped representations.
    private struct JSONValue: Decodable {
        let value: Any
        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if container.decodeNil() { value = NSNull() }
            else if let string = try? container.decode(String.self) { value = string }
            else if let boolean = try? container.decode(Bool.self) { value = boolean }
            else if let integer = try? container.decode(Int.self) { value = integer }
            else if let number = try? container.decode(Double.self) { value = number }
            else if let array = try? container.decode([JSONValue].self) { value = array.map(\.value) }
            else { value = try container.decode([String: JSONValue].self).mapValues(\.value) }
        }
    }
    static func decodeJSON(_ text: String) throws -> Any {
        try JSONDecoder().decode(JSONValue.self, from: Data(text.utf8)).value
    }

    /// Reject conflicting keys before a JSON decoder can silently choose one value.
    static func rejectConflictingFields(_ text: String) -> String {
        struct RetainedValue {
            let range: Range<Int>
            let canonical: Data?
        }
        struct Frame {
            let object: Bool
            let start: Int
            var entry: Int
            var colon = -1
            var values: [String: RetainedValue] = [:]
            var conflict = false
        }
        let chars = Array(text)
        var stack: [Frame] = [], rejected: [(Int, Int)] = []
        var quoted = false, escaped = false
        func canonical(_ range: Range<Int>) -> Data? {
            guard let value = try? decodeJSON(String(chars[range])) else { return nil }
            return try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .fragmentsAllowed])
        }
        func retain(_ frame: inout Frame, _ end: Int) {
            guard frame.object, frame.colon >= 0,
                  let key = (try? decodeJSON(String(chars[frame.entry..<frame.colon]))) as? String else { return }
            let range = (frame.colon + 1)..<end
            // Keep offsets until a repeated key actually needs comparison.
            guard let previous = frame.values[key] else {
                frame.values[key] = RetainedValue(range: range, canonical: nil)
                return
            }
            guard let value = canonical(range) else { return }
            if let prior = previous.canonical ?? canonical(previous.range), prior != value { frame.conflict = true }
            frame.values[key] = RetainedValue(range: range, canonical: value)
        }
        for index in chars.indices {
            let c = chars[index]
            if quoted {
                if escaped { escaped = false } else if c == "\\" { escaped = true } else if c == "\"" { quoted = false }
                continue
            }
            if c == "\"" { quoted = true; continue }
            if c == "{" || c == "[" {
                stack.append(Frame(object: c == "{", start: index, entry: index + 1))
            } else if !stack.isEmpty {
                let last = stack.count - 1
                if c == ":", stack[last].object, stack[last].colon < 0 { stack[last].colon = index }
                else if c == "," {
                    retain(&stack[last], index); stack[last].entry = index + 1; stack[last].colon = -1
                } else if c == "}" || c == "]" {
                    var frame = stack.removeLast(); retain(&frame, index)
                    if frame.conflict { rejected.append((frame.start, index + 1)) }
                }
            }
        }
        var output = "", cursor = 0
        for (start, end) in rejected.sorted(by: { $0.0 < $1.0 }) {
            guard start >= cursor else { continue }
            output += String(chars[cursor..<start]) + "null"; cursor = end
        }
        return output + String(chars[cursor...])
    }

    private static let setFields: Set<String> = ["evidenceIds", "claimEvidenceIds", "terms", "include", "alternatives", "topics", "related", "equivalents", "wikipediaSearchTitles", "facts", "evidence"]

    private static func repairCommas(_ text: String) -> String {
        let chars = Array(text); var result = "", quoted = false, escaped = false
        for index in chars.indices {
            let c = chars[index]
            if quoted {
                if escaped { escaped = false } else if c == "\\" { escaped = true } else if c == "\"" { quoted = false }
            } else if c == "\"" { quoted = true }
            else if c == "," {
                var next = index + 1
                while next < chars.count && chars[next].isWhitespace { next += 1 }
                if next < chars.count && (chars[next] == "}" || chars[next] == "]") { continue }
            }
            result.append(c)
        }
        return result
    }
    private static func completeFields(_ text: String) -> (fields: [String: Any], counts: [String: Int]) {
        let chars = Array(text); var fields: [String: Any] = [:], counts: [String: Int] = [:]
        var depth = 0, quoted = false, escaped = false, stringStart = -1, key: String?, start = -1
        func retain(_ end: Int) {
            guard let key, start >= 0, end >= start,
                  let value = try? decodeJSON(String(chars[start..<end])) else { return }
            fields[key] = value
        }
        for index in chars.indices {
            let c = chars[index]
            if quoted {
                if escaped { escaped = false } else if c == "\\" { escaped = true }
                else if c == "\"" {
                    quoted = false
                    if depth == 1 && start < 0 { key = (try? decodeJSON(String(chars[stringStart...index]))) as? String }
                }
                continue
            }
            if c == ":" && depth == 1, let field = key, start < 0 {
                counts[field, default: 0] += 1
                var next = index + 1
                while next < chars.count && chars[next].isWhitespace { next += 1 }
                start = next; continue
            }
            if c == "\"" { quoted = true; stringStart = index; continue }
            if c == "{" || c == "[" { depth += 1 }
            else if c == "}" || c == "]" { depth -= 1; if depth == 1 { retain(index + 1) } else if depth == 0 { retain(index) } }
            else if c == "," && depth == 1 { retain(index); key = nil; start = -1 }
        }
        return (fields, counts)
    }

    /// Only representation errors are corrected. Content, assignment and citation checks still run afterward.
    public static func normalize(_ input: Any?, schema: [String: Any], field: String = "", root: Bool = false) -> Any? {
        guard var value = input, !(value is NSNull) else { return nil }
        let type = schema["type"] as? String
        if type == "INTEGER", let string = value as? String {
            let text = string.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.range(of: "^(0|[1-9][0-9]*)$", options: .regularExpression) != nil, let integer = Int(text), integer <= 9_007_199_254_740_991 { value = integer }
        }
        if type == "STRING", let string = value as? String { value = string.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines.subtracting(CharacterSet(charactersIn: "\u{FEFF}"))) }
        if let options = schema["enum"] as? [String], let string = value as? String, !options.contains(string) { return nil }
        switch type {
        case "OBJECT":
            guard let object = value as? [String: Any] else { return nil }
            var clean: [String: Any] = [:]
            for (key, itemSchema) in schema["properties"] as? [String: [String: Any]] ?? [:] {
                if let item = normalize(object[key], schema: itemSchema, field: key) { clean[key] = item }
            }
            let properties = schema["properties"] as? [String: [String: Any]] ?? [:]
            let conceptGroup = properties["terms"]?["type"] as? String == "ARRAY" || properties["equivalents"]?["type"] as? String == "ARRAY"
            if conceptGroup {
                let terms = (clean["terms"] ?? clean["equivalents"]) as? [String] ?? []
                if properties["label"]?["type"] as? String == "STRING", clean["label"] == nil, let first = terms.first { clean["label"] = first }
                if properties["related"]?["type"] as? String == "ARRAY", clean["related"] == nil { clean["related"] = [String]() }
            }
            if !root && (schema["required"] as? [String] ?? []).contains(where: { clean[$0] == nil }) { return nil }
            if clean["status"] as? String == "grounded", (schema["properties"] as? [String: Any])?["sentences"] != nil,
               ["title", "hook", "claim", "sentences", "evidence", "claimEvidenceIds"].contains(where: { clean[$0] == nil || (clean[$0] as? [Any])?.isEmpty == true }) { return nil }
            return clean
        case "ARRAY":
            guard let array = value as? [Any] else { return nil }
            let clean = array.compactMap { normalize($0, schema: schema["items"] as? [String: Any] ?? [:]) }
            guard setFields.contains(field) else { return clean }
            var seen = Set<Data>()
            return clean.filter { item in
                guard let data = try? JSONSerialization.data(withJSONObject: item, options: [.sortedKeys, .fragmentsAllowed]) else { return false }
                return seen.insert(data).inserted
            }
        case "STRING": return (value as? String).flatMap { $0.isEmpty ? nil : $0 }
        case "BOOLEAN": return (value as? NSNumber).flatMap { CFGetTypeID($0) == CFBooleanGetTypeID() ? $0 : nil }
        case "INTEGER", "NUMBER":
            guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(), number.doubleValue.isFinite else { return nil }
            if type == "INTEGER" && (number.doubleValue.rounded() != number.doubleValue || abs(number.doubleValue) > 9_007_199_254_740_991) { return nil }
            return number
        default: return value
        }
    }

    public static func parse(_ raw: String, schema: [String: Any]) throws -> [String: Any] {
        let text = rejectConflictingFields(repairCommas(stripResponseBom(raw).trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "^```(?:json)?\\s*|\\s*```$", with: "", options: [.regularExpression, .caseInsensitive]).trimmingCharacters(in: .whitespacesAndNewlines)))
        let parsed: Any
        if let object = try? decodeJSON(text) { parsed = object }
        else {
            guard text.hasPrefix("{") else { throw CocoaError(.propertyListReadCorrupt) }
            let recovered = completeFields(text); var fields = recovered.fields
            for (key, field) in schema["properties"] as? [String: [String: Any]] ?? [:] {
                guard recovered.counts[key] == 1 else { fields[key] = nil; continue }
                if fields[key] == nil && field["type"] as? String == "ARRAY", (field["items"] as? [String: Any])?["type"] as? String == "OBJECT" {
                    let items = JSONArrayItemStreamParser(property: key).append(text)
                    if !items.isEmpty { fields[key] = items }
                }
            }
            guard !fields.isEmpty else { throw CocoaError(.propertyListReadCorrupt) }
            parsed = fields
        }
        guard let object = normalize(parsed, schema: schema, root: true) as? [String: Any] else { throw CocoaError(.propertyListReadCorrupt) }
        return object
    }
}
