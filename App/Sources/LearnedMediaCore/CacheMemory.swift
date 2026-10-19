import Foundation

/// Approximate retained storage without constructing another serialized copy.
/// Conservative for shared Swift values; bounded traversal avoids unbounded cache bookkeeping.
public enum CacheMemory {
    public static func estimatedBytes(_ value: Any, limit: Int = 4 * 1024 * 1024) -> Int {
        let budget = max(0, min(limit, Int.max - 1))
        var total = 0
        func add(_ amount: Int) { total = min(budget + 1, total + min(amount, budget + 1)) }
        func visit(_ item: Any, depth: Int) {
            guard total <= budget else { return }
            guard depth < 64 else { total = budget + 1; return }
            if let text = item as? String { add(16); add(text.utf16.count * 2); return }
            if let data = item as? Data { add(32); add(data.count); return }
            if item is NSNumber || item is Date { add(16); return }
            add(32)
            for child in Mirror(reflecting: item).children {
                add(16)
                visit(child.value, depth: depth + 1)
                if total > budget { break }
            }
        }
        visit(value, depth: 0)
        return total
    }
}
