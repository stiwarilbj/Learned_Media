/// Operation-scoped lookup from evidence IDs to the source records assigned to each batch slot.
/// Keep this index local to one grounding operation so it cannot retain article text afterward.
public struct EvidenceOwnershipIndex<Record> {
    private var recordsByID: [String: [Int: Record]] = [:]

    public init() {}

    /// Preserve the first record for an ID/slot pair, matching per-slot allowlist behavior.
    public mutating func assign(_ record: Record, evidenceID: String, toSlot slot: Int) {
        guard recordsByID[evidenceID]?[slot] == nil else { return }
        recordsByID[evidenceID, default: [:]][slot] = record
    }

    public func record(for evidenceID: String, assignedToSlot slot: Int) -> Record? {
        recordsByID[evidenceID]?[slot]
    }

    public func isAssigned(_ evidenceID: String, toSlot slot: Int) -> Bool {
        recordsByID[evidenceID]?[slot] != nil
    }
}
