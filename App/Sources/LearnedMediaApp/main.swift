import AppKit
import AuthenticationServices
import Cocoa
import CryptoKit
import CoreText
import Foundation
import PDFKit
import UniformTypeIdentifiers
import WebKit
import LearnedMediaCore

private struct NativeError: Error {
    let message: String
    let retryable: Bool
    let outcomes: [[String: Any]]
    let status: String?
    let statusCode: Int?
    let retryAfter: TimeInterval?
    let quotaScope: String?
    let validationDiagnostics: [[String: Any]]

    init(message: String, retryable: Bool = true, outcomes: [[String: Any]] = [], status: String? = nil, statusCode: Int? = nil, retryAfter: TimeInterval? = nil, quotaScope: String? = nil, validationDiagnostics: [[String: Any]] = []) {
        self.message = message
        self.retryable = retryable
        self.outcomes = outcomes
        self.status = status
        self.statusCode = statusCode
        self.retryAfter = retryAfter
        self.validationDiagnostics = validationDiagnostics
        self.quotaScope = quotaScope
    }
}

private struct CloudSession {
    let accessToken: String
    let userID: String
}

private final class SavePanelWaiter: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<NSApplication.ModalResponse, Never>?
    private var cancelled = false
    private var started = false
    private var completed = false

    func install(_ continuation: CheckedContinuation<NSApplication.ModalResponse, Never>) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard !cancelled, !completed else { return false }
        self.continuation = continuation
        return true
    }

    func begin() -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard !cancelled, !completed else { return false }
        started = true
        return true
    }

    /// Returns true when a visible panel should be dismissed on the main thread.
    func cancel() -> Bool {
        lock.lock()
        cancelled = true
        let shouldDismiss = started && !completed
        let pending = !started && !completed ? continuation : nil
        if pending != nil || (!started && !completed) {
            completed = true
            continuation = nil
        }
        lock.unlock()
        pending?.resume(returning: .cancel)
        return shouldDismiss
    }

    func finish(_ response: NSApplication.ModalResponse) {
        lock.lock()
        guard !completed else { lock.unlock(); return }
        completed = true
        let pending = continuation
        continuation = nil
        lock.unlock()
        pending?.resume(returning: response)
    }
}

private struct GeminiCandidate: Decodable {
    let slot: Int?
    let title: String?
    let hook: String?
    let fact: String?
    let claim: String?
    let topicPath: [String]?
    let wikipediaSearchTitles: [String]?
    let difficulty: Int?
}
private struct GeminiCandidateEnvelope: Decodable { let facts: [GeminiCandidate]? }
private struct GeminiGroundedFact: Decodable {
    let topicPath: [String]?
    let status: String?
    let duplicateOf: String?
    let claimEvidenceIds: [String]?
    let missingEvidence: String?
    let slot: Int?
    let title: String?
    let hook: String?
    let body: String?
    let claim: String?
    let sentences: [String]?
    let evidence: [GeminiEvidenceReference]?
    let sourceIndexes: [Int]?
    let difficulty: Int?
    let followUpQuestions: TolerantStringArray?
    let chronology: GeminiChronology?
    let locations: [GeminiLocationHint]?
    enum CodingKeys: String, CodingKey {
        case topicPath, status, duplicateOf, claimEvidenceIds, missingEvidence, slot, title, hook, body, claim, sentences, evidence, sourceIndexes, difficulty, followUpQuestions, chronology, locations
    }
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        topicPath = try container.decodeIfPresent([String].self, forKey: .topicPath)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        duplicateOf = try container.decodeIfPresent(String.self, forKey: .duplicateOf)
        claimEvidenceIds = try container.decodeIfPresent([String].self, forKey: .claimEvidenceIds)
        missingEvidence = try container.decodeIfPresent(String.self, forKey: .missingEvidence)
        slot = try container.decodeIfPresent(Int.self, forKey: .slot)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        hook = try container.decodeIfPresent(String.self, forKey: .hook)
        body = try container.decodeIfPresent(String.self, forKey: .body)
        claim = try container.decodeIfPresent(String.self, forKey: .claim)
        sentences = try container.decodeIfPresent([String].self, forKey: .sentences)
        evidence = try container.decodeIfPresent([GeminiEvidenceReference].self, forKey: .evidence)
        sourceIndexes = try container.decodeIfPresent([Int].self, forKey: .sourceIndexes)
        difficulty = try container.decodeIfPresent(Int.self, forKey: .difficulty)
        // Bad optional suggestions are discarded without making an otherwise valid card undecodable.
        followUpQuestions = (try? container.decode(TolerantStringArray.self, forKey: .followUpQuestions))
        chronology = try? container.decode(GeminiChronology.self, forKey: .chronology)
        locations = try? container.decode([GeminiLocationHint].self, forKey: .locations)
    }
}
private struct GeminiLocationAnchor: Decodable {
    let field: String?
    let sentenceIndex: Int?
}
private struct GeminiLocationHint: Decodable {
    let name: String?
    let articleTitle: String?
    let anchor: GeminiLocationAnchor?
    var dictionary: [String: Any]? {
        guard let name, (2...100).contains(name.trimmingCharacters(in: .whitespacesAndNewlines).count),
              let articleTitle, (2...160).contains(articleTitle.trimmingCharacters(in: .whitespacesAndNewlines).count),
              let anchor, let field = anchor.field, ["title", "hook", "body"].contains(field) else { return nil }
        var anchorValue: [String: Any] = ["field": field]
        if let sentenceIndex = anchor.sentenceIndex, sentenceIndex >= 0 { anchorValue["sentenceIndex"] = sentenceIndex }
        return ["name": name.trimmingCharacters(in: .whitespacesAndNewlines), "articleTitle": articleTitle.trimmingCharacters(in: .whitespacesAndNewlines), "anchor": anchorValue]
    }
}
private struct GeminiChronologyAnchor: Decodable {
    let field: String?
    let sentenceIndex: Int?
}
private struct GeminiChronologyEvent: Decodable {
    let dateText: String?
    let eventText: String?
    let anchor: GeminiChronologyAnchor?
}
private struct GeminiChronology: Decodable {
    let events: [GeminiChronologyEvent]?
    var dictionary: [String: Any]? {
        guard let events else { return nil }
        let valid = events.compactMap { event -> [String: Any]? in
            guard let dateText = event.dateText, !dateText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  let eventText = event.eventText, !eventText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  let anchor = event.anchor, let field = anchor.field, ["title", "hook", "body"].contains(field) else { return nil }
            var anchorValue: [String: Any] = ["field": field]
            if let sentenceIndex = anchor.sentenceIndex { anchorValue["sentenceIndex"] = sentenceIndex }
            return ["dateText": dateText, "eventText": eventText, "anchor": anchorValue]
        }.prefix(8)
        return valid.isEmpty ? nil : ["events": Array(valid)]
    }
}
private struct TolerantStringArray: Decodable {
    let values: [String]
    init(from decoder: Decoder) throws {
        guard var container = try? decoder.unkeyedContainer() else { values = []; return }
        var strings: [String] = []
        while !container.isAtEnd {
            if let value = try? container.decode(String.self) { strings.append(value) }
            else { _ = try container.decode(DiscardedJSONValue.self) }
        }
        values = strings
    }
}
private struct DiscardedJSONValue: Decodable {
    init(from decoder: Decoder) throws {
        if let container = try? decoder.container(keyedBy: DynamicJSONKey.self) {
            for key in container.allKeys { _ = try container.decode(DiscardedJSONValue.self, forKey: key) }
            return
        }
        if var container = try? decoder.unkeyedContainer() {
            while !container.isAtEnd { _ = try container.decode(DiscardedJSONValue.self) }
            return
        }
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { return }
        if (try? container.decode(Bool.self)) != nil { return }
        if (try? container.decode(Double.self)) != nil { return }
        if (try? container.decode(String.self)) != nil { return }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
    }
}
private struct DynamicJSONKey: CodingKey {
    let stringValue: String
    let intValue: Int? = nil
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}
private struct GeminiEvidenceReference: Decodable {
    let sentence: Int
    let evidenceIds: [String]?
    enum CodingKeys: String, CodingKey { case sentence; case evidenceIds = "evidenceIds" }
}
private struct GeminiEvidence {
    let sentence: Int
    let sourceIndex: Int
    let quote: String
    let section: String?
    var dictionary: [String: Any] {
        var value: [String: Any] = ["sentence": sentence, "sourceIndex": sourceIndex, "quote": quote]
        if let section, !section.isEmpty { value["section"] = section }
        return value
    }
}
private struct GeminiGroundedEnvelope: Decodable { let facts: [GeminiGroundedFact]? }
private struct GeminiGlossaryEnvelope: Decodable { let entries: [GeminiGlossaryEntry]? }
private struct GeminiGlossaryEntry: Decodable { let term: String?; let definition: String?; let citationIndexes: [Int]? }
private struct GeminiVideoConceptGroup: Decodable { let label: String?; let terms: [String]?; let related: [String]?; let required: Bool? }
private struct GeminiVideoSearchEnvelope: Decodable {
    let terms: [String]?
    let include: [String]?
    let alternatives: [String]?
    let exclude: [String]?
    let topics: [String]?
    let conceptGroups: [GeminiVideoConceptGroup]?
    let channel: String?
    let channelId: String?
    let dateIntent: String?
    let minDate: String?
    let maxDate: String?
    let minDurationSeconds: Int?
    let maxDurationSeconds: Int?
    let sort: String?
}
private struct GeminiVideoRankMatch: Decodable {
    let videoId: String?
    let relevance: String?
    let support: [String]?
    let explanation: String?
}
private struct GeminiVideoRankEnvelope: Decodable { let matches: [GeminiVideoRankMatch]? }
private struct GeminiNaturalSearchEnvelope: Decodable { let terms: [String]? }

private struct GeminiTextResponse: Decodable {
    struct Candidate: Decodable {
        struct Content: Decodable {
            struct Part: Decodable { let text: String? }
            let parts: [Part]?
        }
        let content: Content?
        let finishReason: String?
    }
    let candidates: [Candidate]?
    let modelVersion: String?
}

private struct WikipediaSearchResponse: Decodable {
    struct Query: Decodable {
        struct Result: Decodable { let title: String? }
        let search: [Result]?
    }
    let error: WikipediaPageResponse.APIError?
    let query: Query?
}

private struct WikipediaPresenceFlag: Decodable, Sendable {
    let isSet: Bool
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(Bool.self) { isSet = value }
        else {
            guard try container.decode(String.self).isEmpty else {
                throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid Wikipedia presence flag.")
            }
            isSet = true
        }
    }
}

private struct WikipediaPageResponse: Decodable, Sendable {
    struct Query: Decodable, Sendable {
        struct Page: Decodable, Sendable {
            let title: String?
            let missing: WikipediaPresenceFlag?
            let invalid: WikipediaPresenceFlag?
            let known: WikipediaPresenceFlag?
            let fullurl: String?
            let extract: String?
            let pageimage: String?
            let thumbnail: Thumbnail?
            let coordinates: [Coordinate]?
            let pageprops: PageProperties?
            struct Thumbnail: Decodable, Sendable { let source: String? }
            struct Coordinate: Decodable, Sendable {
                let lat: Double?
                let lon: Double?
                let primary: WikipediaPresenceFlag?
                let globe: String?
                let type: String?
                let dim: Double?
                let country: String?
                let region: String?
            }
            struct PageProperties: Decodable, Sendable { let disambiguation: WikipediaPresenceFlag? }
        }
        struct TitleMapping: Decodable, Sendable { let from: String; let to: String }
        let normalized: [TitleMapping]?
        let redirects: [TitleMapping]?
        let pages: [String: Page]?

        func verifiedNames(requested: String, canonical: String) -> [String] {
            let mappings = (normalized ?? []) + (redirects ?? [])
            var targets: [String: String] = [:]
            for mapping in mappings { targets[mapping.from] = mapping.to }
            return Array(Set([requested, canonical] + mappings.map(\.from))).filter { name in
                var current = name
                var visited = Set<String>()
                while current != canonical, let next = targets[current], visited.insert(current).inserted { current = next }
                return current == canonical
            }
        }
    }
    struct APIError: Decodable, Sendable { let code: String? }
    let error: APIError?
    let query: Query?
}

private struct WikipediaPlaceCoordinate: Sendable {
    let title: String
    let requestedTitle: String
    let url: String
    let latitude: Double
    let longitude: Double
    let broad: Bool
    var dictionary: [String: Any] { ["title": title, "requestedTitle": requestedTitle, "url": url, "latitude": latitude, "longitude": longitude, "broad": broad] }
}

private struct WikipediaPageResolution: Sendable {
    let page: WikipediaPageResponse.Query.Page
    let verifiedNames: [String]
}

private enum WikipediaPageLookupResult: Sendable {
    case found(WikipediaPageResolution)
    case missing
}

private struct WikipediaLookup {
    let slot: Int
    let title: String
    let searchTitles: [String]
    let claim: String
    let difficulty: Int
    var topicPath: [String] = []
}

/// In-flight work has its own task. Callers can leave without canceling other subscribers.
private actor SharedWikipediaWork<Key: Hashable, Value> {
    private struct Flight {
        let id: UUID
        let task: Task<Void, Never>
        var callers: [UUID: CheckedContinuation<Value, Error>]
    }
    private var flights: [Key: Flight] = [:]

    func value(_ key: Key, load: @escaping @Sendable () async -> Value) async throws -> Value {
        try Task.checkCancellation()
        let caller = UUID()
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                guard !Task.isCancelled else { continuation.resume(throwing: CancellationError()); return }
                if var flight = flights[key] {
                    flight.callers[caller] = continuation
                    flights[key] = flight
                } else {
                    let id = UUID()
                    let task = Task {
                        let result = await load()
                        finish(key, id: id, result: result)
                    }
                    flights[key] = Flight(id: id, task: task, callers: [caller: continuation])
                }
            }
        } onCancel: {
            Task { await self.cancel(key, caller: caller) }
        }
    }
    private func finish(_ key: Key, id: UUID, result: Value) {
        guard let flight = flights[key], flight.id == id else { return }
        flights[key] = nil
        for continuation in flight.callers.values { continuation.resume(returning: result) }
    }
    private func cancel(_ key: Key, caller: UUID) {
        guard var flight = flights[key], let continuation = flight.callers.removeValue(forKey: caller) else { return }
        if flight.callers.isEmpty { flights[key] = nil; flight.task.cancel() }
        else { flights[key] = flight }
        continuation.resume(throwing: CancellationError())
    }
}

private actor WikipediaPageCache {
    private struct Entry<Value> { var value: Value; var expiresAt: Date; var touchedAt: Date; var bytes: Int }
    private var pages: [String: Entry<WikipediaPageResponse.Query.Page>] = [:]
    private var missingPages: [String: Entry<Bool>] = [:]
    private let pageFlights = SharedWikipediaWork<String, WikipediaPageLookupResult?>()
    private var searches: [String: Entry<[String]>] = [:]
    private var placeCoordinates: [String: Entry<[WikipediaPlaceCoordinate]>] = [:]
    private let placeFlights = SharedWikipediaWork<String, [WikipediaPlaceCoordinate]?>()
    private struct ImageKey: Hashable { let fileName: String; let size: Int }
    private var imageInfo: [ImageKey: Entry<WikipediaImageInfoResponse.Query.Page.ImageInfo>] = [:]
    private let imageFlights = SharedWikipediaWork<ImageKey, WikipediaImageInfoResponse.Query.Page.ImageInfo?>()
    private let searchFlights = SharedWikipediaWork<String, [String]?>()
    private let lifetime: TimeInterval = 60 * 60
    private let missingLifetime: TimeInterval = 60
    private let capacity = 100

    private func remember(_ resolution: WikipediaPageResolution, requestedAs title: String) -> WikipediaPageResponse.Query.Page {
        let now = Date()
        pages = pages.filter { $0.value.expiresAt > now }
        let verified = resolution.verifiedNames.contains(title)
        let canonical = resolution.page.title?.lowercased() ?? title.lowercased()
        var entry: Entry<WikipediaPageResponse.Query.Page>
        if verified, let existing = pages[canonical], existing.value.fullurl == resolution.page.fullurl {
            entry = existing
            entry.touchedAt = now
        } else {
            entry = Entry(value: resolution.page, expiresAt: now.addingTimeInterval(lifetime), touchedAt: now, bytes: CacheMemory.estimatedBytes(resolution.page))
        }
        let names = verified ? resolution.verifiedNames : [title]
        for name in names {
            pages[name.lowercased()] = entry
            missingPages[name.lowercased()] = nil
        }
        trim(&pages, budget: 4 * 1024 * 1024)
        return entry.value
    }
    func page(_ title: String) -> WikipediaPageResponse.Query.Page? {
        let key = title.lowercased()
        guard var entry = pages[key], entry.expiresAt > Date() else { pages[key] = nil; PerformanceDiagnostics.shared.record(.wikipedia, .cacheMisses); return nil }
        PerformanceDiagnostics.shared.record(.wikipedia, .cacheHits)
        entry.touchedAt = Date(); pages[key] = entry
        return entry.value
    }
    func places(_ key: String) -> [WikipediaPlaceCoordinate]? {
        guard var entry = placeCoordinates[key], entry.expiresAt > Date() else { placeCoordinates[key] = nil; return nil }
        entry.touchedAt = Date(); placeCoordinates[key] = entry
        PerformanceDiagnostics.shared.record(.wikipedia, .cacheHits)
        return entry.value
    }
    func placesOrLoad(_ key: String, load: @escaping @Sendable () async -> [WikipediaPlaceCoordinate]?) async -> [WikipediaPlaceCoordinate]? {
        guard !Task.isCancelled else { return nil }
        if let cached = places(key) { return cached }
        do {
            guard let result = try await placeFlights.value(key, load: load), !Task.isCancelled else { return nil }
            let now = Date()
            placeCoordinates[key] = Entry(value: result, expiresAt: now.addingTimeInterval(lifetime), touchedAt: now, bytes: CacheMemory.estimatedBytes(result, limit: 512 * 1024))
            trim(&placeCoordinates, budget: 512 * 1024)
            return result
        } catch { return nil }
    }
    func pageOrLoad(_ title: String, load: @escaping @Sendable () async -> WikipediaPageLookupResult?) async -> WikipediaPageResponse.Query.Page? {
        guard !Task.isCancelled else { return nil }
        let key = title.lowercased()
        if var missing = missingPages[key], missing.expiresAt > Date() {
            missing.touchedAt = Date(); missingPages[key] = missing
            PerformanceDiagnostics.shared.record(.wikipedia, .cacheHits)
            return nil
        }
        missingPages[key] = nil
        if let cached = page(title) { return cached }
        guard !Task.isCancelled,
              let result = try? await pageFlights.value(key, load: load), !Task.isCancelled else { return nil }
        switch result {
        case .found(let resolution): return remember(resolution, requestedAs: title)
        case .missing:
            // A concurrently verified redirect may already have supplied this page.
            if let existing = pages[key], existing.expiresAt > Date() { return existing.value }
            let now = Date()
            missingPages[key] = Entry(value: true, expiresAt: now.addingTimeInterval(missingLifetime), touchedAt: now, bytes: 1)
            trim(&missingPages, budget: 64 * 1024)
            return nil
        }
    }
    func imageInfoOrLoad(fileName: String, size: Int, load: @escaping @Sendable () async -> WikipediaImageInfoResponse.Query.Page.ImageInfo?) async -> WikipediaImageInfoResponse.Query.Page.ImageInfo? {
        // Use the file name supplied by Wikipedia, preserving meaningful case.
        let key = ImageKey(fileName: fileName.replacingOccurrences(of: "_", with: " ").trimmingCharacters(in: .whitespacesAndNewlines), size: size)
        if var entry = imageInfo[key], entry.expiresAt > Date() {
            entry.touchedAt = Date(); imageInfo[key] = entry
            return entry.value
        }
        imageInfo[key] = nil
        let result = try? await imageFlights.value(key, load: load)
        guard !Task.isCancelled else { return nil }
        if let result {
            let now = Date()
            imageInfo = imageInfo.filter { $0.value.expiresAt > now }
            imageInfo[key] = Entry(value: result, expiresAt: now.addingTimeInterval(lifetime), touchedAt: now, bytes: CacheMemory.estimatedBytes(result, limit: 512 * 1024))
            trim(&imageInfo, budget: 512 * 1024)
        }
        return result
    }
    func search(_ query: String) -> [String]? {
        let key = query.lowercased()
        guard var entry = searches[key], entry.expiresAt > Date() else { searches[key] = nil; PerformanceDiagnostics.shared.record(.wikipedia, .cacheMisses); return nil }
        PerformanceDiagnostics.shared.record(.wikipedia, .cacheHits)
        entry.touchedAt = Date(); searches[key] = entry
        return entry.value
    }
    func insertSearch(_ results: [String], query: String) {
        store(results, key: query.lowercased(), in: &searches)
    }
    func searchOrLoad(_ query: String, load: @escaping @Sendable () async -> [String]?) async -> [String] {
        guard !Task.isCancelled else { return [] }
        if let cached = search(query) { return cached }
        guard let result = try? await searchFlights.value(query.lowercased(), load: load), !Task.isCancelled else { return [] }
        insertSearch(result, query: query)
        return result
    }
    private func store<Value>(_ value: Value, key: String, in entries: inout [String: Entry<Value>]) {
        let now = Date()
        entries = entries.filter { $0.value.expiresAt > now }
        entries[key] = Entry(value: value, expiresAt: now.addingTimeInterval(lifetime), touchedAt: now, bytes: CacheMemory.estimatedBytes(value, limit: 256 * 1024))
        trim(&entries, budget: 256 * 1024)
    }
    private func trim<Key: Hashable, Value>(_ entries: inout [Key: Entry<Value>], budget: Int) {
        entries = entries.filter { $0.value.expiresAt > Date() }
        func retainedBytes() -> Int {
            entries.reduce(0) { $0 + $1.value.bytes + 96 + CacheMemory.estimatedBytes($1.key, limit: budget) }
        }
        while entries.count > capacity || retainedBytes() > budget {
            guard let oldest = entries.min(by: { $0.value.touchedAt < $1.value.touchedAt })?.key else { break }
            entries[oldest] = nil
        }
    }
}
private struct WikipediaImageInfoResponse: Decodable, Sendable {
    struct Query: Decodable, Sendable {
        struct Page: Decodable, Sendable {
            struct ImageInfo: Decodable, Sendable {
                let url: String?
                let thumburl: String?
                let descriptionurl: String?
                let extmetadata: [String: MetadataValue]?
            }
            let imageinfo: [ImageInfo]?
        }
        let pages: [String: Page]?
    }
    let query: Query?
}
private struct MetadataValue: Decodable, Sendable { let value: String? }

private actor WikipediaRequestLimiter {
    private final class Waiter {
        let id: UUID
        let priority: Int
        let origin: String
        let continuation: CheckedContinuation<Void, Error>
        var active = true

        init(id: UUID, priority: Int, origin: String, continuation: CheckedContinuation<Void, Error>) {
            self.id = id
            self.priority = priority
            self.origin = origin
            self.continuation = continuation
        }
    }
    private struct WaitQueue {
        var entries: [Waiter] = []
        var head = 0
        var inactiveCount = 0
        var activeCount = 0
    }
    private var permits = 4
    private var queues: [Int: WaitQueue] = [:]
    private var waitersByID: [UUID: Waiter] = [:]
    private var activeWaiterCount = 0
    private let clock = ContinuousClock()
    private var notBeforeByOrigin: [String: ContinuousClock.Instant] = [:]
    private var cooldownWakeTask: Task<Void, Never>?
    private var cooldownWakeDeadline: ContinuousClock.Instant?

    func acquire(priority: Int = 0, origin: String) async throws {
        try Task.checkCancellation()
        if permits > 0 && activeWaiterCount == 0 && cooldownDeadline(for: origin, now: clock.now) == nil { permits -= 1; return }
        let id = UUID()
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                guard !Task.isCancelled else { continuation.resume(throwing: CancellationError()); return }
                let waiter = Waiter(id: id, priority: priority, origin: origin, continuation: continuation)
                var queue = queues[priority] ?? WaitQueue()
                queue.entries.append(waiter)
                queue.activeCount += 1
                queues[priority] = queue
                waitersByID[id] = waiter
                activeWaiterCount += 1
                dispatchWaiters()
            }
        } onCancel: {
            Task { await self.cancel(id) }
        }
    }
    private func cancel(_ id: UUID) {
        guard let waiter = waitersByID.removeValue(forKey: id), waiter.active else { return }
        waiter.active = false
        activeWaiterCount -= 1
        if var queue = queues[waiter.priority] {
            queue.activeCount -= 1
            queue.inactiveCount += 1
            compact(&queue, priority: waiter.priority)
        }
        waiter.continuation.resume(throwing: CancellationError())
        dispatchWaiters()
    }
    private func compact(_ queue: inout WaitQueue, priority: Int) {
        guard queue.activeCount > 0 else {
            queues[priority] = nil
            return
        }
        let compactWhen = queue.head >= 64 && queue.head * 2 >= queue.entries.count
            || queue.inactiveCount >= 64 && queue.inactiveCount * 2 >= queue.entries.count
        guard compactWhen else {
            queues[priority] = queue
            return
        }
        queue.entries = queue.entries[queue.head...].filter(\.active)
        queue.head = 0
        queue.inactiveCount = 0
        queues[priority] = queue
    }
    private func cooldownDeadline(for origin: String, now: ContinuousClock.Instant) -> ContinuousClock.Instant? {
        guard let deadline = notBeforeByOrigin[origin] else { return nil }
        guard deadline > now else { notBeforeByOrigin[origin] = nil; return nil }
        return deadline
    }

    private func nextWaiter(now: ContinuousClock.Instant) -> (waiter: Waiter?, earliestCooldown: ContinuousClock.Instant?) {
        var earliestCooldown: ContinuousClock.Instant?
        for priority in queues.keys.sorted() {
            guard var queue = queues[priority] else { continue }
            while queue.head < queue.entries.count && !queue.entries[queue.head].active { queue.head += 1 }
            guard queue.activeCount > 0 else {
                queues[priority] = nil
                continue
            }
            var selectedIndex: Int?
            for index in queue.head..<queue.entries.count {
                let waiter = queue.entries[index]
                guard waiter.active else { continue }
                if let deadline = cooldownDeadline(for: waiter.origin, now: now) {
                    earliestCooldown = earliestCooldown.map { min($0, deadline) } ?? deadline
                    continue
                }
                selectedIndex = index
                break
            }
            guard let selectedIndex else {
                compact(&queue, priority: priority)
                continue
            }
            let waiter = queue.entries[selectedIndex]
            waiter.active = false
            queue.activeCount -= 1
            queue.inactiveCount += 1
            activeWaiterCount -= 1
            waitersByID[waiter.id] = nil
            if selectedIndex == queue.head {
                while queue.head < queue.entries.count && !queue.entries[queue.head].active { queue.head += 1 }
            }
            compact(&queue, priority: priority)
            return (waiter, earliestCooldown)
        }
        return (nil, earliestCooldown)
    }

    private func dispatchWaiters() {
        while permits > 0 {
            let next = nextWaiter(now: clock.now)
            guard let waiter = next.waiter else {
                scheduleCooldownWake(at: next.earliestCooldown)
                return
            }
            permits -= 1
            waiter.continuation.resume()
        }
        scheduleCooldownWake(at: nil)
    }

    private func scheduleCooldownWake(at deadline: ContinuousClock.Instant?) {
        guard permits > 0, activeWaiterCount > 0, let deadline else {
            cooldownWakeTask?.cancel()
            cooldownWakeTask = nil
            cooldownWakeDeadline = nil
            return
        }
        guard cooldownWakeDeadline != deadline else { return }
        cooldownWakeTask?.cancel()
        cooldownWakeDeadline = deadline
        let clock = self.clock
        cooldownWakeTask = Task { [weak self] in
            do { try await clock.sleep(until: deadline) }
            catch { return }
            guard !Task.isCancelled else { return }
            await self?.cooldownDidExpire(deadline)
        }
    }

    private func cooldownDidExpire(_ deadline: ContinuousClock.Instant) {
        guard cooldownWakeDeadline == deadline else { return }
        cooldownWakeTask = nil
        cooldownWakeDeadline = nil
        let now = clock.now
        for origin in Array(notBeforeByOrigin.keys) where (notBeforeByOrigin[origin] ?? now) <= now {
            notBeforeByOrigin[origin] = nil
        }
        dispatchWaiters()
    }

    func applyCooldown(origin: String, seconds: TimeInterval) {
        guard seconds.isFinite, seconds > 0 else { return }
        let milliseconds = Int64(min(seconds * 1_000, Double(Int64.max / 4)).rounded(.up))
        let deadline = clock.now.advanced(by: .milliseconds(milliseconds))
        if let current = notBeforeByOrigin[origin], current >= deadline { return }
        notBeforeByOrigin[origin] = deadline
        dispatchWaiters()
    }

    func release() {
        permits += 1
        dispatchWaiters()
    }
}

private func wikipediaOrigin(_ url: URL) -> String {
    let scheme = (url.scheme ?? "https").lowercased()
    let host = (url.host ?? "").lowercased()
    let defaultPort = scheme == "https" ? 443 : (scheme == "http" ? 80 : nil)
    let portSuffix = url.port.flatMap { $0 == defaultPort ? nil : ":\($0)" } ?? ""
    return "\(scheme)://\(host)\(portSuffix)"
}

private actor YouTubeRequestLimiter {
    private var permits = 4
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func acquire() async {
        if permits > 0 {
            permits -= 1
            return
        }
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            waiters.append(continuation)
        }
    }

    func release() {
        if let waiter = waiters.first {
            waiters.removeFirst()
            waiter.resume()
        } else {
            permits += 1
        }
    }
}

private final class KeychainStore {
    private let service = "com.learnedmedia.app"
    func read(_ account: String) -> Data? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }
    func save(_ account: String, data: Data) throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        if data.isEmpty { SecItemDelete(query as CFDictionary); return }
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw NativeError(message: "Keychain could not remember the credential.") }
        } else if status != errSecSuccess { throw NativeError(message: "Keychain could not update the credential.") }
    }
    func saveSession(_ data: Data) throws { try save("supabase-session", data: data) }
    func readSession() -> Data? { read("supabase-session") }
    func deleteSession() { try? save("supabase-session", data: Data()) }
}

private final class LocalWorkspaceStore {
    private let fileManager = FileManager.default

    private func urls() throws -> (primary: URL, backup: URL) {
        let base = try fileManager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let folder = base.appendingPathComponent("Learned Media", isDirectory: true)
        try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
        let primary = folder.appendingPathComponent("learning-state.json")
        return (primary, primary.appendingPathExtension("backup"))
    }

    private func readObject(at url: URL) -> (object: Any, bytes: Data)? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        guard let object = try? JSONSerialization.jsonObject(with: data) else {
            SnapshotValidation.recordInvalidJSON(kind: .nativeStore, operation: .read); return nil
        }
        return SnapshotValidation.validate(object, kind: .nativeStore, operation: .read) ? (object, data) : nil
    }

    func load() -> Any {
        guard let locations = try? urls() else { return NSNull() }
        return readObject(at: locations.primary)?.object ?? readObject(at: locations.backup)?.object ?? NSNull()
    }

    func save(_ value: Any?) throws {
        guard let value, SnapshotValidation.validate(value, kind: .nativeStore, operation: .save) else {
            if value == nil { _ = SnapshotValidation.validate(nil, kind: .nativeStore, operation: .save) }
            throw NativeError(message: "Workspace data failed validation. The last valid recovery copy was kept.", retryable: false)
        }
        guard JSONSerialization.isValidJSONObject(value) else {
            SnapshotValidation.recordInvalidJSON(kind: .nativeStore, operation: .save)
            throw NativeError(message: "The local workspace contained unsupported data.", retryable: false)
        }
        let data = try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
        let locations = try urls()
        if let previous = readObject(at: locations.primary) {
            try previous.bytes.write(to: locations.backup, options: [.atomic])
        }
        try data.write(to: locations.primary, options: [.atomic])
    }
}

private final class WikipediaClient: @unchecked Sendable {
    private let session = URLSession(configuration: .ephemeral)
    private let limiter = WikipediaRequestLimiter()
    private let retryAfterDateParser = RetryAfterDateParser()
    private let pageCache = WikipediaPageCache()
    private let downloads = ConditionalDownloadCache()
    private func request<T: Decodable>(_ url: URL, priority: Int = 0) async throws -> T {
        var request = URLRequest(url: url, timeoutInterval: 20)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("LearnedMedia/1.0 (knowledge-feed)", forHTTPHeaderField: "User-Agent")
        let conditional = await downloads.prepare(request)
        let origin = wikipediaOrigin(url)
        let queuedAt = ProcessInfo.processInfo.systemUptime
        try await limiter.acquire(priority: priority, origin: origin)
        PerformanceDiagnostics.shared.record(.wikipedia, .queueMs, max(0, ProcessInfo.processInfo.systemUptime - queuedAt) * 1_000)
        let data: Data
        let response: URLResponse
        do {
            try Task.checkCancellation()
            PerformanceDiagnostics.shared.record(.wikipedia, .requests)
            (data, response) = try await session.data(for: conditional.request)
        } catch {
            await limiter.release()
            throw error
        }
        if let http = response as? HTTPURLResponse,
           http.statusCode == 429 || http.statusCode == 503,
           let value = http.value(forHTTPHeaderField: "Retry-After"),
           let delay = await retryAfterDateParser.delay(from: value) {
            await limiter.applyCooldown(origin: wikipediaOrigin(http.url ?? url), seconds: delay)
        }
        await limiter.release()
        PerformanceDiagnostics.shared.record(.wikipedia, .responseBytesRead, Double(data.count))
        try Task.checkCancellation()
        guard let http = response as? HTTPURLResponse else { throw NativeError(message: "Wikipedia could not be reached right now.") }
        let reused = await downloads.notModified(conditional, response: http)
        guard (200..<300).contains(http.statusCode) || reused != nil else { throw NativeError(message: "Wikipedia could not be reached right now.") }
        let body = reused ?? data
        let decoded: T
        do { decoded = try JSONDecoder().decode(T.self, from: body) }
        catch { await downloads.discard(conditional); throw error }
        if reused != nil { PerformanceDiagnostics.shared.record(.wikipedia, .cacheHits) }
        else if http.statusCode == 200, reusableResponse(decoded) {
            try Task.checkCancellation()
            await downloads.validated(conditional, response: http, body: body)
        } else { await downloads.discard(conditional) }
        return decoded
    }
    private func reusableResponse<T>(_ decoded: T) -> Bool {
        if let response = decoded as? WikipediaPageResponse, response.error == nil,
           let pages = response.query?.pages, !pages.isEmpty {
            // A missing-page marker must expire through the separate one-minute cache.
            return pages.values.allSatisfy { $0.missing == nil && $0.invalid == nil && $0.known == nil && $0.fullurl?.isEmpty == false }
        }
        if let response = decoded as? WikipediaSearchResponse { return response.error == nil && response.query?.search != nil }
        if let response = decoded as? WikipediaImageInfoResponse {
            return response.query?.pages?.values.contains(where: { $0.imageinfo?.first?.url?.isEmpty == false }) == true
        }
        return false
    }
    private func apiURL(_ values: [String: String]) -> URL? {
        var components = URLComponents(string: "https://en.wikipedia.org/w/api.php")
        components?.queryItems = ([URLQueryItem(name: "format", value: "json"), URLQueryItem(name: "origin", value: "*")] + values.map { URLQueryItem(name: $0.key, value: $0.value) }).sorted { $0.name < $1.name }
        return components?.url
    }
    private func wikiURL(_ title: String) -> String {
        let encoded = title.replacingOccurrences(of: " ", with: "_").addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? title
        return "https://en.wikipedia.org/wiki/\(encoded)"
    }
    fileprivate static func evidenceLink(_ url: String, quote: String?) -> String {
        let cleaned = quote?
            .replacingOccurrences(of: "^\\[Section:[^\\]]+\\]\\s*", with: "", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let text = cleaned, text.count >= 30 else { return url }
        let shortened = String(text.prefix(180))
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
        let encoded = shortened.addingPercentEncoding(withAllowedCharacters: allowed) ?? shortened
        return "\(url.components(separatedBy: "#").first ?? url)#:~:text=\(encoded)"
    }
    private func fetchPage(_ title: String) async -> WikipediaPageResponse.Query.Page? {
        guard !Task.isCancelled, let url = apiURL(["action": "query", "titles": title, "redirects": "1", "prop": "pageimages|info|extracts", "inprop": "url", "explaintext": "1", "exsectionformat": "wiki", "piprop": "thumbnail|name", "pilicense": "free", "pithumbsize": "1200"]) else { return nil }
        return await pageCache.pageOrLoad(title) { [weak self] in
            guard let self, !Task.isCancelled,
                  let response: WikipediaPageResponse = try? await self.request(url),
                  !Task.isCancelled, response.error == nil else { return nil }
            let pages = Array(response.query?.pages?.values ?? [:].values)
            if let page = pages.first(where: { $0.missing == nil && $0.invalid == nil && $0.known == nil && $0.fullurl != nil && $0.extract?.isEmpty == false }) {
                return .found(WikipediaPageResolution(page: page, verifiedNames: response.query?.verifiedNames(requested: title, canonical: page.title ?? "") ?? []))
            }
            // Only an explicit, title-verified missing marker earns a brief cache entry.
            if pages.count == 1, let page = pages.first, page.missing?.isSet == true,
               page.invalid == nil, page.known == nil, let canonical = page.title,
               response.query?.verifiedNames(requested: title, canonical: canonical).contains(title) == true {
                return .missing
            }
            return nil
        }
    }

    private func pagesFor(_ titles: [String]) async -> [String: WikipediaPageResponse.Query.Page] {
        let unique = Array(NSOrderedSet(array: titles.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })) as? [String] ?? []
        return await withTaskGroup(of: (String, WikipediaPageResponse.Query.Page?).self, returning: [String: WikipediaPageResponse.Query.Page].self) { group in
            for title in unique {
                group.addTask { (title, await self.fetchPage(title)) }
            }
            var pages: [String: WikipediaPageResponse.Query.Page] = [:]
            for await (requestedTitle, page) in group {
                guard let page else { continue }
                pages[requestedTitle.lowercased()] = page
                if let actualTitle = page.title { pages[actualTitle.lowercased()] = page }
            }
            return pages
        }
    }

    func resolveBatch(_ lookups: [WikipediaLookup]) async -> [Int: [[String: Any]]] {
        let queriesBySlot = Dictionary(uniqueKeysWithValues: lookups.map { lookup in
            (lookup.slot, Array(NSOrderedSet(array: [lookup.title] + lookup.searchTitles).compactMap { $0 as? String }.prefix(3)))
        })
        let allExactTitles = queriesBySlot.values.flatMap { $0 }
        let exactPages = await pagesFor(allExactTitles)
        var fallbackQueryBySlot: [Int: String] = [:]
        for lookup in lookups {
            let focus = lookup.claim + " " + lookup.title + " " + lookup.topicPath.suffix(2).joined(separator: " ")
            let supportsClaim = (queriesBySlot[lookup.slot] ?? []).contains { title in
                guard let extract = exactPages[title.lowercased()]?.extract else { return false }
                return !FactQuality.evidence(extract, focus: focus, level: lookup.difficulty).isEmpty
            }
            if !supportsClaim { fallbackQueryBySlot[lookup.slot] = focus }
        }
        let uniqueFallbackQueries = Dictionary(fallbackQueryBySlot.values.map { ($0.lowercased(), $0) }, uniquingKeysWith: { first, _ in first })
        let fallbackSearches = await withTaskGroup(of: (String, [String]).self, returning: [String: [String]].self) { group in
            for (key, query) in uniqueFallbackQueries {
                group.addTask {
                    let titles = await self.pageCache.searchOrLoad(query) {
                        guard !Task.isCancelled, let searchURL = self.apiURL(["action": "query", "list": "search", "srsearch": query, "srnamespace": "0", "srlimit": "3"]) else { return nil }
                        guard let result: WikipediaSearchResponse = try? await self.request(searchURL) else { return nil }
                        return Array(result.query?.search?.compactMap(\.title).prefix(3) ?? [])
                    }
                    return (key, titles)
                }
            }
            var results: [String: [String]] = [:]
            for await (key, titles) in group { results[key] = titles }
            return results
        }
        let fallbackTitles = fallbackQueryBySlot.mapValues { fallbackSearches[$0.lowercased()] ?? [] }
        let fallbackPages = await pagesFor(fallbackTitles.values.flatMap { $0 })
        var resolved: [Int: [[String: Any]]] = [:]
        for lookup in lookups {
            let exact = (queriesBySlot[lookup.slot] ?? []).compactMap { exactPages[$0.lowercased()] }
            let fallback = (fallbackTitles[lookup.slot] ?? []).compactMap { fallbackPages[$0.lowercased()] }
            let pages = Array((fallbackQueryBySlot[lookup.slot] != nil ? fallback : exact).prefix(3))
            resolved[lookup.slot] = pages.compactMap { page in
                guard let title = page.title, let url = page.fullurl, let extract = page.extract else { return nil }
                let evidence = FactQuality.evidence(extract, focus: lookup.title + " " + lookup.claim + " " + lookup.topicPath.suffix(2).joined(separator: " "), level: lookup.difficulty)
                guard !evidence.isEmpty else { return nil }
                return ["title": title, "url": url, "canonicalUrl": url, "extract": evidence]
            }
        }
        return resolved
    }

    func resolve(title: String, searchTitles: [String]) async -> [[String: Any]] {
        let lookup = WikipediaLookup(slot: 0, title: title, searchTitles: searchTitles, claim: title, difficulty: 5)
        return await resolveBatch([lookup])[0] ?? []
    }

    func article(title: String) async -> [String: Any]? {
        guard !Task.isCancelled, let page = await fetchPage(title), !Task.isCancelled,
              let canonicalTitle = page.title, let url = page.fullurl, let extract = page.extract else { return nil }
        return ["title": canonicalTitle, "url": url, "canonicalUrl": url, "extract": extract]
    }

    func coordinates(titles: [String]) async -> [[String: Any]]? {
        var seen = Set<String>()
        let unique = Array(titles.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && seen.insert($0.lowercased()).inserted }.prefix(2))
        guard !unique.isEmpty else { return [] }
        let key = unique.map { $0.lowercased() }.sorted().joined(separator: "\u{0}")
        guard let places = await pageCache.placesOrLoad(key, load: { [weak self] in
            guard let self, !Task.isCancelled,
                  let url = self.apiURL(["action": "query", "titles": unique.joined(separator: "|"), "redirects": "1", "prop": "coordinates|info|pageprops", "inprop": "url", "coprimary": "primary", "coprop": "type|dim|country|region"]),
                  let response: WikipediaPageResponse = try? await self.request(url), !Task.isCancelled,
                  response.error == nil, let query = response.query else { return nil }
            let pages = Array(query.pages?.values ?? [:].values)
            var result: [WikipediaPlaceCoordinate] = []
            for requested in unique {
                for page in pages {
                    guard page.missing == nil, page.invalid == nil, page.known == nil,
                          page.pageprops?.disambiguation?.isSet != true,
                          let title = page.title, let fullurl = page.fullurl,
                          query.verifiedNames(requested: requested, canonical: title).contains(requested),
                          let point = page.coordinates?.first(where: { coordinate in
                              coordinate.primary?.isSet == true && coordinate.globe?.lowercased() == "earth"
                                  && coordinate.lat.map { (-90...90).contains($0) } == true
                                  && coordinate.lon.map { (-180...180).contains($0) } == true
                          }), let latitude = point.lat, let longitude = point.lon else { continue }
                    let broadType = ["country", "continent", "region", "adm1", "adm2"].contains(point.type?.lowercased() ?? "")
                    let broad = broadType || (point.dim ?? 0) >= 500_000
                    result.append(WikipediaPlaceCoordinate(title: title, requestedTitle: requested, url: fullurl, latitude: latitude, longitude: longitude, broad: broad))
                    break
                }
            }
            return result
        }) else { return nil }
        return places.map { $0.dictionary }
    }

    private func fetchImageInfo(fileName: String, size: Int) async -> WikipediaImageInfoResponse.Query.Page.ImageInfo? {
        await pageCache.imageInfoOrLoad(fileName: fileName, size: size) { [weak self] in
            guard let self,
                  let url = self.apiURL(["action": "query", "titles": "File:\(fileName)", "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": String(size)]),
                  let payload: WikipediaImageInfoResponse = try? await self.request(url, priority: 1) else { return nil }
            return payload.query?.pages?.values.first?.imageinfo?.first
        }
    }

    func image(for source: [String: Any]) async -> [String: Any]? {
        guard let sourceTitle = source["title"] as? String,
              let page = await pageCache.page(sourceTitle),
              let sourceURL = page.fullurl else { return nil }
        if let pageimage = page.pageimage,
           let info = await fetchImageInfo(fileName: pageimage, size: 1400) {
            let credit = info.extmetadata?["Artist"]?.value ?? info.extmetadata?["Credit"]?.value ?? "Wikipedia image"
            return ["url": info.thumburl ?? info.url ?? page.thumbnail?.source ?? "", "alt": sourceTitle, "sourceTitle": sourceTitle, "sourceUrl": sourceURL, "fileUrl": info.url ?? "", "filePageUrl": info.descriptionurl ?? "https://commons.wikimedia.org/wiki/File:\(pageimage)", "credit": credit.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)]
        }
        guard let thumbnail = page.thumbnail?.source else { return nil }
        return ["url": thumbnail, "alt": sourceTitle, "sourceTitle": sourceTitle, "sourceUrl": sourceURL, "filePageUrl": sourceURL, "credit": "Wikipedia image"]
    }
}

private actor ModelScheduler {
    private struct RequestWaiter {
        let priority: Int
        let order: Int
        let continuation: CheckedContinuation<Void, Never>
    }
    private var models: [String] = []
    private var working = Set<String>()
    private var failed = Set<String>()
    private var cooldowns: [String: Date] = [:]
    private var transientFailureCounts: [String: Int] = [:]
    private var projectQuotaCooldown: Date?
    private var resolvedByRequested: [String: String] = [:]
    private var inFlight = Set<String>()
    private var inFlightResolved = Set<String>()
    private var ready = false
    private var requestLocked = false
    private var requestWaiters: [RequestWaiter] = []
    private var nextWaiterOrder = 0

    func acquireRequest(priority: Int = 0) async {
        let queuedAt = ProcessInfo.processInfo.systemUptime
        defer { PerformanceDiagnostics.shared.record(.gemini, .queueMs, max(0, ProcessInfo.processInfo.systemUptime - queuedAt) * 1_000) }
        if !requestLocked {
            requestLocked = true
            return
        }
        await withCheckedContinuation { continuation in
            requestWaiters.append(RequestWaiter(priority: priority, order: nextWaiterOrder, continuation: continuation))
            nextWaiterOrder += 1
        }
    }

    func releaseRequest() {
        if !requestWaiters.isEmpty {
            let nextIndex = requestWaiters.indices.min { left, right in
                let a = requestWaiters[left], b = requestWaiters[right]
                return a.priority == b.priority ? a.order < b.order : a.priority < b.priority
            }!
            requestWaiters.remove(at: nextIndex).continuation.resume()
        } else {
            requestLocked = false
        }
    }

    func update(_ next: [String]) {
        models = GeminiModelPolicy.sort(next)
        working = working.intersection(Set(models))
        failed = failed.intersection(Set(models))
        cooldowns = cooldowns.filter { models.contains($0.key) }
        transientFailureCounts = transientFailureCounts.filter { models.contains($0.key) }
        resolvedByRequested = resolvedByRequested.filter { models.contains($0.key) }
    }

    func hasModels() -> Bool { !models.isEmpty }
    func isReady() -> Bool { ready }
    func hasAvailableModels() -> Bool { !availableModels().isEmpty }
    func setReady(_ value: Bool) { ready = value }
    func reset() {
        models = []
        working.removeAll()
        failed.removeAll()
        cooldowns.removeAll()
        transientFailureCounts.removeAll()
        projectQuotaCooldown = nil
        resolvedByRequested.removeAll()
        inFlight.removeAll()
        inFlightResolved.removeAll()
        ready = false
    }

    func reserve(_ model: String) -> Bool {
        guard inFlight.isEmpty, availableModels().contains(model) else { return false }
        if let resolved = resolvedByRequested[model], inFlightResolved.contains(resolved) { return false }
        inFlight.insert(model)
        if let resolved = resolvedByRequested[model] { inFlightResolved.insert(resolved) }
        return true
    }

    func retryCandidateModels(allowedModels: [String]? = nil) -> [String] {
        var resolved = Set<String>()
        return models.filter { model in
            guard !failed.contains(model), allowedModels?.contains(model) ?? true else { return false }
            if let version = resolvedByRequested[model], !resolved.insert(version).inserted { return false }
            return true
        }
    }

    func retryDate(for model: String) -> Date? { cooldowns[model] }

    func release(_ model: String) {
        inFlight.remove(model)
        if let resolved = resolvedByRequested[model] { inFlightResolved.remove(resolved) }
    }

    func markSuccess(_ model: String, resolvedModel: String?) {
        working.insert(model)
        failed.remove(model)
        cooldowns[model] = nil
        transientFailureCounts[model] = nil
        if let resolvedModel, !resolvedModel.isEmpty { resolvedByRequested[model] = resolvedModel }
        release(model)
    }

    func markFailure(_ model: String, retryable: Bool, retryAfter: TimeInterval = 0, statusCode: Int? = nil, quotaScope: String? = nil) -> Date? {
        let retryAt: Date?
        if retryable {
            let failureCount = (transientFailureCounts[model] ?? 0) + 1
            let delay = statusCode == 429 ? max(45, retryAfter) : GeminiRetryTiming.transientDelay(failureCount: failureCount, retryAfter: retryAfter)
            if statusCode != 429 { transientFailureCounts[model] = failureCount }
            retryAt = Date().addingTimeInterval(delay)
            cooldowns[model] = retryAt
            if statusCode == 429, quotaScope != "model" { projectQuotaCooldown = retryAt }
        } else {
            working.remove(model)
            failed.insert(model)
            cooldowns[model] = nil
            transientFailureCounts[model] = nil
            retryAt = nil
        }
        release(model)
        return retryAt
    }

    func availableCount(excluding tried: Set<String>) -> Int {
        availableModels().filter { !tried.contains($0) && !inFlight.contains($0) }.count
    }

    func healthyCount() -> Int {
        var resolved = Set<String>()
        return working.reduce(into: 0) { count, model in
            if let version = resolvedByRequested[model] {
                if resolved.insert(version).inserted { count += 1 }
            } else {
                count += 1
            }
        }
    }

    func inFlightCount() -> Int { inFlight.count }

    func nextRetryDate(allowedModels: [String]? = nil) -> Date? {
        let modelDates = cooldowns.filter { item in (allowedModels?.contains(item.key) ?? true) && item.value > Date() }.map(\.value)
        let projectDate = projectQuotaCooldown.flatMap { $0 > Date() ? $0 : nil }
        return (modelDates + [projectDate].compactMap { $0 }).min()
    }

    func projectQuotaRetryDate() -> Date? {
        guard let projectQuotaCooldown, projectQuotaCooldown > Date() else { return nil }
        return projectQuotaCooldown
    }

    func availableModels(allowedModels: [String]? = nil) -> [String] {
        let now = Date()
        if let projectQuotaCooldown, projectQuotaCooldown > now { return [] }
        var seenResolved = Set<String>()
        return models.filter { model in
            guard !failed.contains(model), allowedModels?.contains(model) ?? true, (cooldowns[model] ?? .distantPast) <= now else { return false }
            if let resolved = resolvedByRequested[model] {
                guard !seenResolved.contains(resolved) else { return false }
                seenResolved.insert(resolved)
            }
            return true
        }
    }
}

private struct GeminiModelCheckResult {
    let model: String
    let status: String
    let latencyMs: Int
    let checkedAt: String
    let error: String?
    let resolvedModel: String?
    let retryAt: String?
    let statusCode: Int?
    let quotaScope: String?

    init(model: String, status: String, latencyMs: Int, checkedAt: String, error: String?, resolvedModel: String?, retryAt: String? = nil, statusCode: Int? = nil, quotaScope: String? = nil) {
        self.model = model
        self.status = status
        self.latencyMs = latencyMs
        self.checkedAt = checkedAt
        self.error = error
        self.resolvedModel = resolvedModel
        self.retryAt = retryAt
        self.statusCode = statusCode
        self.quotaScope = quotaScope
    }

    var dictionary: [String: Any] {
        var result: [String: Any] = ["model": model, "status": status, "latencyMs": latencyMs, "checkedAt": checkedAt]
        if let error { result["error"] = error }
        if let resolvedModel, !resolvedModel.isEmpty { result["resolvedModel"] = resolvedModel }
        if let retryAt { result["retryAt"] = retryAt }
        if let statusCode { result["statusCode"] = statusCode }
        if let quotaScope { result["quotaScope"] = quotaScope }
        return result
    }
}

private struct GeminiGenerationSlot {
    let index: Int
    let slotId: String?
    let path: [String]
    let level: Int
    var mode: String
    var candidate: GeminiCandidate?
    var sources: [[String: Any]]
    var lastError: String?
    var candidateOutputFloor = 0
    var groundingOutputFloor = 0
}

private typealias GeminiStructuredResult = (text: String, model: String, resolvedModel: String?, outcomes: [[String: Any]])

private struct GeminiCandidateGroupResult {
    let slots: [Int]
    let candidates: [Int: GeminiCandidate]
    let sources: [Int: [[String: Any]]]
    let outcomes: [[String: Any]]
    let error: String?
    let status: String?
}

private struct GeminiGroundedGroupResult {
    let slots: [Int]
    let facts: [Int: GeminiGroundedFact]
    let evidenceBySlot: [Int: [String: GeminiEvidence]]
    let model: String?
    let resolvedModel: String?
    let outcomes: [[String: Any]]
    let error: String?
    let status: String?
}

private struct GeminiGroundingPlan {
    let prompt: String
    let evidenceBySlot: [Int: [String: GeminiEvidence]]
}

private actor ValidatedCardEvidenceCache {
    private struct Entry { let source: [String: Any]; let expiresAt: Date; let bytes: Int }
    private var entries: [String: [Entry]] = [:]
    private var order: [String] = []
    private func key(_ slot: GeminiGenerationSlot) -> String { "\(slot.level)|" + slot.path.joined(separator: "\u{0}") }
    func sources(_ slot: GeminiGenerationSlot) -> [[String: Any]] {
        let k = key(slot), fresh = (entries[k] ?? []).filter { $0.expiresAt > Date() }
        entries[k] = fresh
        order.removeAll { $0 == k }; if !fresh.isEmpty { order.append(k) }
        return fresh.map(\.source)
    }
    func record(_ slot: GeminiGenerationSlot) {
        let k = key(slot)
        var fresh = (entries[k] ?? []).filter { $0.expiresAt > Date() }
        for source in slot.sources {
            let url = source["canonicalUrl"] as? String ?? source["url"] as? String ?? ""
            let extract = source["extract"] as? String ?? ""
            if !fresh.contains(where: { ($0.source["canonicalUrl"] as? String ?? $0.source["url"] as? String ?? "") == url && $0.source["extract"] as? String == extract }) {
                fresh.append(Entry(source: source, expiresAt: Date().addingTimeInterval(3600), bytes: CacheMemory.estimatedBytes(source)))
            }
        }
        entries[k] = Array(fresh.suffix(48)); order.removeAll { $0 == k }; order.append(k)
        for stale in Array(entries.keys) {
            entries[stale] = entries[stale]?.filter { $0.expiresAt > Date() }
            if entries[stale]?.isEmpty == true { entries[stale] = nil; order.removeAll { $0 == stale } }
        }
        func retainedBytes() -> Int { entries.reduce(0) { $0 + 96 + $1.key.utf16.count * 2 + $1.value.reduce(0) { $0 + $1.bytes + 32 } } }
        while order.count > 100 || retainedBytes() > 4 * 1024 * 1024 {
            guard !order.isEmpty else { break }
            entries[order.removeFirst()] = nil
        }
    }
}

private enum NativeDateFormatting {
    static let iso8601UTC = Date.ISO8601FormatStyle(includingFractionalSeconds: false, timeZone: TimeZone(secondsFromGMT: 0)!)
}

private actor RetryAfterDateParser {
    private let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        return formatter
    }()

    func date(from value: String) -> Date? {
        formatter.date(from: value)
    }

    func delay(from value: String, relativeTo now: Date = Date()) -> TimeInterval? {
        let value = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if let seconds = TimeInterval(value), seconds.isFinite, seconds > 0 { return seconds }
        guard let date = formatter.date(from: value) else { return nil }
        let delay = date.timeIntervalSince(now)
        return delay.isFinite && delay > 0 ? delay : nil
    }
}

private final class GeminiClient {
    private let session = URLSession(configuration: .ephemeral)
    private let wikipedia = WikipediaClient()
    private let validatedEvidence = ValidatedCardEvidenceCache()
    private let scheduler = ModelScheduler()
    private let structuredCache = RequestWorkCache<GeminiStructuredResult>()
    private let retryAfterDateParser = RetryAfterDateParser()

    func reset() async {
        await scheduler.acquireRequest(priority: 0)
        await scheduler.reset()
        await structuredCache.clear()
        await scheduler.releaseRequest()
    }

    func resolveImage(source: [String: Any]) async -> [String: Any]? {
        await wikipedia.image(for: source)
    }

    func wikipediaArticle(title: String) async -> [String: Any]? {
        await wikipedia.article(title: title)
    }

    func wikipediaCoordinates(titles: [String]) async -> [[String: Any]]? {
        await wikipedia.coordinates(titles: titles)
    }

    private func isoNow(_ date: Date = Date()) -> String { NativeDateFormatting.iso8601UTC.format(date) }

    private func isCredentialFailure(_ message: String) -> Bool {
        message.range(of: "401|403|API key|permission|unauthorized|forbidden", options: [.caseInsensitive, .regularExpression]) != nil
    }

    private func retryAfter(_ response: HTTPURLResponse, data: Data) async -> TimeInterval? {
        if let value = response.value(forHTTPHeaderField: "Retry-After"), let seconds = TimeInterval(value), seconds > 0 { return seconds }
        if let value = response.value(forHTTPHeaderField: "Retry-After") {
            if let date = await retryAfterDateParser.date(from: value), date > Date() { return date.timeIntervalSinceNow }
        }
        let detail = String(data: data, encoding: .utf8) ?? ""
        if let pattern = try? NSRegularExpression(pattern: #"retryDelay["']?\s*:\s*["'](\d+(?:\.\d+)?)s"#, options: .caseInsensitive),
           let match = pattern.firstMatch(in: detail, range: NSRange(detail.startIndex..., in: detail)),
           let range = Range(match.range(at: 1), in: detail),
           let seconds = TimeInterval(detail[range]), seconds > 0 { return seconds }
        return nil
    }

    private func quotaScope(_ status: Int, detail: String) -> String? {
        guard status == 429 else { return nil }
        if detail.range(of: "per.?day|daily quota|requests? per day|tokens? per day|project.{0,40}quota|quota.{0,40}project|billing", options: [.caseInsensitive, .regularExpression]) != nil { return "project" }
        if detail.range(of: "per.?model|model[_ -]specific|quota.{0,40}model|model.{0,40}quota|per.project.per.model", options: [.caseInsensitive, .regularExpression]) != nil { return "model" }
        return "unknown"
    }

    private func requestModel(_ model: String, key: String, prompt: String, schema: [String: Any], maxOutputTokens: Int = 4096, timeout: TimeInterval = 45, streaming: Bool = false, onTextChunk: ((String) -> Void)? = nil) async throws -> (text: String, resolvedModel: String?, finishReason: String?) {
        let method = streaming ? "streamGenerateContent?alt=sse" : "generateContent"
        let endpoint = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model):\(method)")!
        var request = URLRequest(url: endpoint, timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(streaming ? "text/event-stream" : "application/json", forHTTPHeaderField: "Accept")
        request.setValue(key, forHTTPHeaderField: "x-goog-api-key")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["contents": [["role": "user", "parts": [["text": prompt]]]], "generationConfig": ["temperature": 0.92, "maxOutputTokens": max(128, min(maxOutputTokens, 65_536)), "responseMimeType": "application/json", "responseSchema": schema]])
        PerformanceDiagnostics.shared.record(.gemini, .requestBytes, Double(request.httpBody?.count ?? 0))
        PerformanceDiagnostics.shared.record(.gemini, .requests)
        var receivedBytes = 0
        defer { PerformanceDiagnostics.shared.record(.gemini, .responseBytesRead, Double(receivedBytes)) }
        let (data, response): (Data, URLResponse)
        do {
            if streaming {
                let (bytes, streamResponse) = try await session.bytes(for: request)
                response = streamResponse
                var raw = Data()
                var eventLines: [String] = []
                var streamedText = ""
                var streamedModel: String?
                var streamedFinishReason: String?
                func consumeEvent() throws {
                    guard !eventLines.isEmpty else { return }
                    let event = eventLines.joined(separator: "\n")
                    eventLines.removeAll(keepingCapacity: true)
                    guard event != "[DONE]" else { return }
                    guard let eventData = event.data(using: .utf8),
                          let payload = try? JSONDecoder().decode(GeminiTextResponse.self, from: eventData) else {
                        throw NativeError(message: "Gemini returned malformed streamed output.", retryable: true)
                    }
                    streamedModel = payload.modelVersion ?? streamedModel
                    streamedFinishReason = payload.candidates?.first?.finishReason ?? streamedFinishReason
                    let chunk = payload.candidates?.first?.content?.parts?.compactMap(\.text).joined() ?? ""
                    if !chunk.isEmpty {
                        streamedText += chunk
                        onTextChunk?(chunk)
                    }
                }
                guard let http = streamResponse as? HTTPURLResponse else { throw NativeError(message: "Gemini returned no HTTP response.") }
                if (200..<300).contains(http.statusCode) {
                    for try await line in bytes.lines {
                        raw.append(contentsOf: line.utf8)
                        raw.append(10)
                        receivedBytes = raw.count
                        if line.isEmpty { try consumeEvent() }
                        else if line.hasPrefix("data:") { eventLines.append(String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)) }
                    }
                    try consumeEvent()
                    let cleaned = StructuredResponse.stripResponseBom(streamedText).replacingOccurrences(of: "^```json\\s*|^```\\s*|\\s*```$", with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                    return (cleaned, streamedModel, streamedFinishReason)
                }
                for try await line in bytes.lines { raw.append(contentsOf: line.utf8); raw.append(10); receivedBytes = raw.count }
                data = raw
            } else {
                let result = try await session.data(for: request)
                data = result.0
                receivedBytes = data.count
                response = result.1
            }
        } catch is CancellationError {
            throw NativeError(message: "Gemini request canceled.", retryable: false)
        } catch let error as NativeError {
            throw error
        } catch {
            throw NativeError(message: "Gemini request timed out or could not reach Google.", retryable: true)
        }
        guard let http = response as? HTTPURLResponse else { throw NativeError(message: "Gemini returned no HTTP response.") }
        if !(200..<300).contains(http.statusCode) {
            let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let detail = ((object?["error"] as? [String: Any])?["message"] as? String) ?? "Gemini returned HTTP \(http.statusCode)."
            let scope = quotaScope(http.statusCode, detail: String(data: data, encoding: .utf8) ?? detail)
            let retryable = [408, 409, 429].contains(http.statusCode) || http.statusCode >= 500
            throw NativeError(message: "Gemini HTTP \(http.statusCode): \(detail)", retryable: retryable, statusCode: http.statusCode, retryAfter: await retryAfter(http, data: data), quotaScope: scope)
        }
        let payload: GeminiTextResponse
        do {
            payload = try JSONDecoder().decode(GeminiTextResponse.self, from: data)
        } catch {
            throw NativeError(message: "Gemini returned malformed JSON.", retryable: true)
        }
        let text = payload.candidates?.first?.content?.parts?.compactMap(\.text).joined() ?? ""
        return (StructuredResponse.stripResponseBom(text).replacingOccurrences(of: "^```json\\s*|^```\\s*|\\s*```$", with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines), payload.modelVersion, payload.candidates?.first?.finishReason)
    }

    private func ensureModels(key: String) async throws {
        if !(await scheduler.hasModels()) { await scheduler.update(GeminiModelPolicy.allowedModels) }
    }

    private func structured(key: String, prompt: String, schema: [String: Any], stage: String, timeout: TimeInterval = 45, priority: Int = 0, allowedModels: [String]? = nil, maxOutputTokens: Int = 4096, cacheContext: String = "", identity: Data? = nil, streaming: Bool = false, onStreamAttemptStart: (() -> Void)? = nil, onStreamText: ((String) -> Void)? = nil) async throws -> (text: String, model: String, resolvedModel: String?, outcomes: [[String: Any]]) {
        try Task.checkCancellation()
        if stage == "learning" {
            let schemaData = try JSONSerialization.data(withJSONObject: schema, options: [.sortedKeys])
            let cacheSource = Data("\(key)\u{0}\(stage)\u{0}\(allowedModels?.joined(separator: ",") ?? "all")\u{0}\(maxOutputTokens)\u{0}\(cacheContext)\u{0}".utf8) + (identity ?? Data(prompt.utf8)) + schemaData
            let cacheKey = SHA256.hash(data: cacheSource).map { String(format: "%02x", $0) }.joined()
            return try await structuredCache.value(key: cacheKey, reusable: { RequestIdentity.reusableJSON($0.text, schema: schema) }) {
                try await self.queuedStructured(key: key, prompt: prompt, schema: schema, stage: stage, timeout: timeout, priority: priority, allowedModels: allowedModels, maxOutputTokens: maxOutputTokens, streaming: streaming, onStreamAttemptStart: onStreamAttemptStart, onStreamText: onStreamText)
            }
        }
        return try await queuedStructured(key: key, prompt: prompt, schema: schema, stage: stage, timeout: timeout, priority: priority, allowedModels: allowedModels, maxOutputTokens: maxOutputTokens, streaming: streaming, onStreamAttemptStart: onStreamAttemptStart, onStreamText: onStreamText)
    }

    private func queuedStructured(key: String, prompt: String, schema: [String: Any], stage: String, timeout: TimeInterval, priority: Int, allowedModels: [String]?, maxOutputTokens: Int, streaming: Bool, onStreamAttemptStart: (() -> Void)?, onStreamText: ((String) -> Void)?) async throws -> GeminiStructuredResult {
        await scheduler.acquireRequest(priority: priority)
        do {
            try Task.checkCancellation()
            try await ensureModels(key: key)
            guard await scheduler.isReady() else { throw NativeError(message: "Connect Gemini and wait until both primary Flash Lite models pass their structured-output checks.", retryable: false) }
            let result = try await performStructured(key: key, prompt: prompt, schema: schema, stage: stage, timeout: timeout, allowedModels: allowedModels, maxOutputTokens: maxOutputTokens, recover: priority == 0, streaming: streaming, onStreamAttemptStart: onStreamAttemptStart, onStreamText: onStreamText)
            await scheduler.releaseRequest()
            return result
        } catch {
            await scheduler.releaseRequest()
            throw error
        }
    }

    private func performStructured(key: String, prompt: String, schema: [String: Any], stage: String, timeout: TimeInterval, allowedModels: [String]?, maxOutputTokens: Int, recover: Bool, streaming: Bool = false, onStreamAttemptStart: (() -> Void)? = nil, onStreamText: ((String) -> Void)? = nil) async throws -> (text: String, model: String, resolvedModel: String?, outcomes: [[String: Any]]) {
        var outcomes: [[String: Any]] = []
        var lastError: NativeError?
        if let retryAt = await scheduler.projectQuotaRetryDate() {
            throw NativeError(message: "Gemini's project quota is cooling down. Retry after the displayed time.", retryable: true, status: "rate-limited", statusCode: 429, retryAfter: retryAt.timeIntervalSinceNow)
        }
        let candidates = await scheduler.retryCandidateModels(allowedModels: allowedModels)
        guard !candidates.isEmpty else { throw NativeError(message: "No available Gemini models remain. Reconnect in Settings to check model availability again.", retryable: false, status: "unavailable") }
        let hadAvailableModels = !(await scheduler.availableModels(allowedModels: allowedModels)).isEmpty
        var outputCapacity = OutputCapacity.next(maxOutputTokens)
        let rounds = GeminiModelPolicy.attemptRounds(models: candidates, recover: recover)
        for (round, models) in rounds.enumerated() {
            for model in models {
                if Task.isCancelled { throw NativeError(message: "Gemini request canceled.", retryable: false) }
                guard await scheduler.retryCandidateModels(allowedModels: allowedModels).contains(model) else { continue }
                if let retryAt = await scheduler.retryDate(for: model), retryAt > Date() {
                    if !recover || round == 0 && hadAvailableModels { continue }
                    while retryAt > Date() {
                        do { try await Task.sleep(nanoseconds: UInt64(min(60, max(0, retryAt.timeIntervalSinceNow)) * 1_000_000_000)) }
                        catch { throw NativeError(message: "Gemini request canceled.", retryable: false) }
                    }
                }
                guard await scheduler.reserve(model) else { continue }
                if !outcomes.isEmpty { PerformanceDiagnostics.shared.record(.gemini, .retries) }
                let started = Date()
                let attemptCapacity = outputCapacity
                var finishReason: String?
                do {
                    try Task.checkCancellation()
                    if streaming { onStreamAttemptStart?() }
                    let result = try await requestModel(model, key: key, prompt: prompt, schema: schema, maxOutputTokens: attemptCapacity, timeout: timeout, streaming: streaming, onTextChunk: streaming ? onStreamText : nil)
                    finishReason = result.finishReason ?? "UNKNOWN"
                    outputCapacity = OutputCapacity.next(attemptCapacity, finishReason: finishReason)
                    guard let object = try? StructuredResponse.parse(result.text, schema: schema), object.keys.isEmpty == false,
                          let repaired = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]), let text = String(data: repaired, encoding: .utf8) else { throw NativeError(message: finishReason == "MAX_TOKENS" ? "Gemini reached its output limit before a complete item arrived." : "Gemini returned malformed structured output.", retryable: true) }
                    let latency = Int(Date().timeIntervalSince(started) * 1000)
                    outcomes.append(["model": model, "resolvedModel": result.resolvedModel ?? model, "finishReason": finishReason ?? "UNKNOWN", "outputLimitReached": finishReason == "MAX_TOKENS", "maxOutputTokens": attemptCapacity, "stage": stage, "status": "success", "latencyMs": latency])
                    await scheduler.markSuccess(model, resolvedModel: result.resolvedModel)
                    return (text, model, result.resolvedModel, outcomes)
                } catch {
                    if Task.isCancelled || error is CancellationError {
                        await scheduler.release(model)
                        throw NativeError(message: "Gemini request canceled.", retryable: false)
                    }
                    let nativeError = error as? NativeError
                    let message = nativeError?.message ?? "Gemini request failed."
                    let retryable = nativeError?.retryable ?? true
                    let latency = Int(Date().timeIntervalSince(started) * 1000)
                    let retryAt = await scheduler.markFailure(model, retryable: retryable, retryAfter: nativeError?.retryAfter ?? 0, statusCode: nativeError?.statusCode, quotaScope: nativeError?.quotaScope)
                    var outcome: [String: Any] = ["model": model, "stage": stage, "status": retryable ? "cooldown" : "failed", "latencyMs": latency, "error": message]
                    if let finishReason {
                        outcome["finishReason"] = finishReason
                        outcome["outputLimitReached"] = finishReason == "MAX_TOKENS"
                        outcome["maxOutputTokens"] = attemptCapacity
                    }
                    if let retryAt { outcome["retryAt"] = isoNow(retryAt) }
                    if let scope = nativeError?.quotaScope { outcome["quotaScope"] = scope }
                    outcomes.append(outcome)
                    if isCredentialFailure(message) {
                        throw NativeError(message: message, retryable: false, outcomes: outcomes, status: "invalid", statusCode: nativeError?.statusCode)
                    }
                    if nativeError?.statusCode == 429, nativeError?.quotaScope != "model" {
                        let scopedMessage = nativeError?.quotaScope == "project" ? "Gemini's project quota is exhausted. Retry after its reset time." : message
                        throw NativeError(message: scopedMessage, retryable: true, outcomes: outcomes, status: "rate-limited", statusCode: nativeError?.statusCode, retryAfter: nativeError?.retryAfter, quotaScope: nativeError?.quotaScope ?? "unknown")
                    }
                    if !retryable && nativeError?.statusCode != 404 {
                        throw NativeError(message: message, retryable: false, outcomes: outcomes, status: "unavailable", statusCode: nativeError?.statusCode)
                    }
                    lastError = nativeError ?? NativeError(message: message, retryable: retryable)
                }
            }
        }
        if Task.isCancelled { throw NativeError(message: "Gemini request canceled.", retryable: false) }
        let retryDate = await scheduler.nextRetryDate(allowedModels: allowedModels)
        let cooldownOnly = !outcomes.isEmpty && outcomes.allSatisfy { $0["status"] as? String == "cooldown" }
        let status = cooldownOnly || (outcomes.isEmpty && retryDate != nil) ? "rate-limited" : "unavailable"
        let exhaustion = recover ? "after the initial pass and both recovery cycles" : "this request"
        let message = outcomes.isEmpty ? "All available Gemini models are cooling down. Retry after the displayed retry time." : "Every available Gemini model failed \(exhaustion). \(lastError?.message ?? "Retry after checking the model status in Settings.")"
        throw NativeError(message: message, retryable: status == "rate-limited", outcomes: outcomes, status: status)
    }

    private func checkModel(key: String, model: String, onCheck: @escaping ([String: Any], Int) -> Void) async -> GeminiModelCheckResult {
        let started = Date()
        do {
            let result = try await requestModel(model, key: key, prompt: PromptBuilder.build(.connection), schema: ["type": "OBJECT", "properties": ["ok": ["type": "BOOLEAN"]], "required": ["ok"]], maxOutputTokens: 128, timeout: 20)
            let object = try JSONSerialization.jsonObject(with: Data(result.text.utf8)) as? [String: Any]
            guard object?["ok"] as? Bool == true else { throw NativeError(message: "The model returned invalid structured test output.") }
            await scheduler.markSuccess(model, resolvedModel: result.resolvedModel)
            let check = GeminiModelCheckResult(model: model, status: "working", latencyMs: Int(Date().timeIntervalSince(started) * 1000), checkedAt: isoNow(), error: nil, resolvedModel: result.resolvedModel)
            onCheck(check.dictionary, await scheduler.healthyCount())
            return check
        } catch {
            let message = (error as? NativeError)?.message ?? "Model check failed."
            let retryable = (error as? NativeError)?.retryable ?? message.contains("429") || message.contains("503")
            let native = error as? NativeError
            let retryAt = await scheduler.markFailure(model, retryable: retryable, retryAfter: native?.retryAfter ?? 0, statusCode: native?.statusCode, quotaScope: native?.quotaScope)
            let check = GeminiModelCheckResult(model: model, status: retryable ? "cooldown" : "failed", latencyMs: Int(Date().timeIntervalSince(started) * 1000), checkedAt: isoNow(), error: message, resolvedModel: nil, retryAt: retryAt.map { isoNow($0) }, statusCode: native?.statusCode, quotaScope: native?.quotaScope)
            onCheck(check.dictionary, await scheduler.healthyCount())
            return check
        }
    }

    func test(key: String, onCheck: @escaping ([String: Any], Int) -> Void) async -> [String: Any] {
        guard !key.isEmpty else {
            let models = GeminiModelPolicy.allowedModels.map { GeminiModelCheckResult(model: $0, status: "unchecked", latencyMs: 0, checkedAt: "", error: nil, resolvedModel: nil).dictionary }
            return ["status": "not-configured", "models": models, "eligibleModelCount": GeminiModelPolicy.allowedModels.count, "requiredWorkingModels": GeminiModelPolicy.requiredWorkingModels]
        }
        await scheduler.acquireRequest()
        if let retryAt = await scheduler.projectQuotaRetryDate() {
            await scheduler.releaseRequest()
            let retryText = isoNow(retryAt)
            let models = GeminiModelPolicy.allowedModels.map { model in
                GeminiModelCheckResult(model: model, status: "cooldown", latencyMs: 0, checkedAt: "", error: "Gemini project quota is cooling down.", resolvedModel: nil, retryAt: retryText, statusCode: 429, quotaScope: "project").dictionary
            }
            return ["status": "rate-limited", "message": "Gemini's project quota is cooling down. Retry after the displayed time.", "models": models, "eligibleModelCount": GeminiModelPolicy.allowedModels.count, "requiredWorkingModels": GeminiModelPolicy.requiredWorkingModels]
        }
        await scheduler.reset()
        await structuredCache.clear()
        await scheduler.update(GeminiModelPolicy.allowedModels)
        var checks = GeminiModelPolicy.allowedModels.map { GeminiModelCheckResult(model: $0, status: "unchecked", latencyMs: 0, checkedAt: "", error: nil, resolvedModel: nil) }
        for model in GeminiModelPolicy.primaryModels {
            let result = await checkModel(key: key, model: model, onCheck: onCheck)
            if let index = checks.firstIndex(where: { $0.model == model }) { checks[index] = result }
            if result.statusCode == 401 || result.statusCode == 403 || result.error.map(isCredentialFailure) == true { break }
            if result.statusCode == 429 && result.quotaScope != "model" { break }
            if result.status == "failed" && result.statusCode != 404 { break }
        }
        let dictionaries = checks.map(\.dictionary)
        let workingResolved = Set(checks.filter { $0.status == "working" }.map { $0.resolvedModel ?? $0.model })
        let ready = workingResolved.count >= GeminiModelPolicy.requiredWorkingModels
        await scheduler.setReady(ready)
        let primaryChecks = checks.filter { GeminiModelPolicy.primaryModels.contains($0.model) && $0.status != "unchecked" }
        let invalid = primaryChecks.contains { $0.statusCode == 401 || $0.statusCode == 403 || ($0.error.map(isCredentialFailure) ?? false) }
        let status = ready ? "connected" : invalid ? "invalid" : primaryChecks.contains(where: { $0.status == "cooldown" }) ? "rate-limited" : "unavailable"
        await scheduler.releaseRequest()
        return ["status": status, "message": ready ? "Gemini connected. Both primary Flash Lite models passed; other models are automatic fallbacks." : "Both primary Flash Lite models must pass. Check their status and retry the connection.", "models": dictionaries, "eligibleModelCount": GeminiModelPolicy.allowedModels.count, "requiredWorkingModels": GeminiModelPolicy.requiredWorkingModels]
    }

    private func candidateSchema(slotCount: Int) -> [String: Any] {
        ["type": "OBJECT", "properties": ["facts": ["type": "ARRAY", "maxItems": slotCount, "items": ["type": "OBJECT", "properties": ["slot": ["type": "INTEGER"], "title": ["type": "STRING"], "claim": ["type": "STRING"], "topicPath": ["type": "ARRAY", "items": ["type": "STRING"]], "wikipediaSearchTitles": ["type": "ARRAY", "minItems": 1, "maxItems": 3, "items": ["type": "STRING"]]], "required": ["slot", "title", "claim", "topicPath", "wikipediaSearchTitles"]]]], "required": ["facts"]]
    }

    private func groundedSchema(sentenceCount: Int) -> [String: Any] {
        ["type": "OBJECT", "properties": ["facts": ["type": "ARRAY", "items": ["type": "OBJECT", "properties": [
            "slot": ["type": "INTEGER"], "status": ["type": "STRING", "enum": ["grounded", "needs_evidence", "duplicate", "angle_unavailable"]], "duplicateOf": ["type": "STRING"], "claimEvidenceIds": ["type": "ARRAY", "minItems": 1, "maxItems": 3, "items": ["type": "STRING"]], "missingEvidence": ["type": "STRING"], "title": ["type": "STRING"], "hook": ["type": "STRING"], "claim": ["type": "STRING"],
            "sentences": ["type": "ARRAY", "minItems": sentenceCount, "maxItems": sentenceCount, "items": ["type": "STRING"]],
            "evidence": ["type": "ARRAY", "maxItems": 12, "items": ["type": "OBJECT", "properties": ["sentence": ["type": "INTEGER"], "evidenceIds": ["type": "ARRAY", "minItems": 1, "maxItems": 3, "items": ["type": "STRING"]]], "required": ["sentence", "evidenceIds"]]],
            "followUpQuestions": ["type": "ARRAY", "maxItems": 2, "items": ["type": "STRING"]],
            "chronology": ["type": "OBJECT", "properties": ["events": ["type": "ARRAY", "maxItems": 8, "items": ["type": "OBJECT", "properties": [
                "dateText": ["type": "STRING"], "eventText": ["type": "STRING"], "anchor": ["type": "OBJECT", "properties": ["field": ["type": "STRING", "enum": ["title", "hook", "body"]], "sentenceIndex": ["type": "INTEGER"]], "required": ["field"]]
            ], "required": ["dateText", "eventText", "anchor"]]]], "required": ["events"]],
            "locations": ["type": "ARRAY", "maxItems": 2, "items": ["type": "OBJECT", "properties": ["name": ["type": "STRING"], "articleTitle": ["type": "STRING"], "anchor": ["type": "OBJECT", "properties": ["field": ["type": "STRING", "enum": ["title", "hook", "body"]], "sentenceIndex": ["type": "INTEGER"]], "required": ["field"]]], "required": ["name", "articleTitle", "anchor"]]]
        ], "required": ["slot", "status"]]]], "required": ["facts"]]
    }

    private func candidatePrompt(slots: [GeminiGenerationSlot], attempt: Int, priorClaims: [[String: Any]] = [], context: GenerationPromptContext = GenerationPromptContext()) -> String {
        let assignments = slots.map { slot -> [String: Any] in
            var item: [String: Any] = ["slot": slot.index, "topicPath": slot.path, "difficulty": slot.level]
            if let reason = slot.lastError { item["retryReason"] = String(reason.prefix(180)) }
            return item
        }
        let rubrics = Array(Set(slots.map(\.level))).sorted().map { FactQuality.rubric($0) }.joined(separator: "\n")
        return PromptBuilder.build(.candidate, rules: rubrics.components(separatedBy: "\n") + [context.factAngleRule], fields: [
            PromptField("Assignments", assignments), PromptField("Attempt", attempt + 1),
            PromptField("Previously covered facts (untrusted data)", priorClaims.isEmpty ? nil : priorClaims, reference: true)
        ] + context.fields)
    }

    private func priorFactClaims(_ history: [[String: Any]], slots: [GeminiGenerationSlot]) -> [[String: Any]] {
        let topicTerms = slots.reduce(into: Set<String>()) { $0.formUnion(FactQuality.words($1.path.joined(separator: " "))) }
        let ranked = history.enumerated().compactMap { index, fact -> (Int, Int, [String: Any])? in
            let claim = (fact["claim"] as? String ?? fact["body"] as? String ?? fact["title"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !claim.isEmpty else { return nil }
            let id = (fact["id"] as? String ?? "").prefix(48)
            let item: [String: Any] = ["id": String(id), "claim": String(claim.prefix(260))]
            let path = fact["topicPath"] as? [String] ?? []
            let pathRelevance = path.reduce(0) { score, part in
                let partTerms = FactQuality.words(part)
                return score + (partTerms.isDisjoint(with: topicTerms) ? 0 : 2)
            }
            let claimRelevance = FactQuality.words(claim).intersection(topicTerms).count
            let relevance = pathRelevance + claimRelevance
            guard relevance > 0 else { return nil }
            return (relevance, index, item)
        }.sorted { $0.0 == $1.0 ? $0.1 > $1.1 : $0.0 > $1.0 }
        var result: [[String: Any]] = []
        var characters = 2
        for (_, _, item) in ranked {
            guard result.count < 12 else { break }
            let size = ((try? JSONSerialization.data(withJSONObject: item, options: [.sortedKeys])).map { String(data: $0, encoding: .utf8)?.count ?? 0 }) ?? 0
            guard characters + size + 1 <= 2_400 else { continue }
            result.append(item); characters += size + 1
        }
        return result
    }

    private func evidenceSpans(_ source: [String: Any], sourceIndex: Int) -> [(section: String, quote: String, key: String)] {
        guard let extract = source["extract"] as? String else { return [] }
        var result: [(String, String, String)] = []
        for block in extract.components(separatedBy: "\n\n") {
            let lines = block.components(separatedBy: .newlines)
            guard let heading = lines.first, heading.hasPrefix("[Section: "), heading.hasSuffix("]") else { continue }
            let section = String(heading.dropFirst("[Section: ".count).dropLast()).trimmingCharacters(in: .whitespacesAndNewlines)
            let paragraph = lines.dropFirst().joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !section.isEmpty, !paragraph.isEmpty else { continue }
            let sentences = FactQuality.completeSentences(paragraph)
            var current = ""
            var quotes: [String] = []
            for sentence in sentences {
                let next = current.isEmpty ? sentence : current + " " + sentence
                if !current.isEmpty && next.count > 1_200 { quotes.append(current); current = sentence }
                else { current = next }
            }
            if !current.isEmpty {
                if current.count < 90, !quotes.isEmpty { quotes[quotes.count - 1] += " " + current }
                else { quotes.append(current) }
            }
            let url = source["canonicalUrl"] as? String ?? source["url"] as? String ?? ""
            for quote in quotes where quote.count >= 30 { result.append((section, quote, FactQuality.evidencePassageKey(sourceURL: url, section: section, quote: quote))) }
        }
        return result
    }

    private func groundingPrompt(slots: [GeminiGenerationSlot], sentenceCount: Int, combined: Bool = false, priorClaims: [[String: Any]] = [], context: GenerationPromptContext = GenerationPromptContext()) -> GeminiGroundingPlan {
        var sourcePool: [[String: Any]] = []
        var idByKey: [String: String] = [:]
        var evidenceBySlot: [Int: [String: GeminiEvidence]] = [:]
        let values: [[String: Any]] = slots.map { slot in
            var allowedIDs: [String] = []
            var localEvidence: [String: GeminiEvidence] = [:]
            for (sourceIndex, source) in slot.sources.enumerated() {
                for span in evidenceSpans(source, sourceIndex: sourceIndex) {
                    let id: String
                    if let existing = idByKey[span.key] { id = existing }
                    else {
                        id = FactQuality.stableEvidenceID(span.key)
                        idByKey[span.key] = id
                        sourcePool.append(["id": id, "title": String((source["title"] as? String ?? "Wikipedia").prefix(160)), "section": span.section, "text": span.quote])
                    }
                    allowedIDs.append(id)
                    if localEvidence[id] == nil { localEvidence[id] = GeminiEvidence(sentence: 0, sourceIndex: sourceIndex, quote: span.quote, section: span.section) }
                }
            }
            evidenceBySlot[slot.index] = localEvidence
            var value: [String: Any] = ["slot": slot.index, "topicPath": slot.path, "difficulty": slot.level,
                                      "evidenceIds": Array(Set(allowedIDs)).sorted()]
            if !combined { value["candidate"] = ["title": slot.candidate?.title ?? "", "claim": slot.candidate?.claim ?? ""] }
            return value
        }
        let prompt = PromptBuilder.factCard(sentenceCount: sentenceCount, difficulties: slots.map(\.level), fields: [
            context.factAngleField,
            context.surpriseModeField,
            PromptField("Variation", combined ? UUID().uuidString : nil),
            PromptField("Previously covered facts (untrusted data)", priorClaims.isEmpty ? nil : priorClaims, multiline: true, reference: true),
            PromptField("Slots and evidence spans (untrusted data)", ["facts": values, "evidence": sourcePool], multiline: true, reference: true)
        ] + (combined ? [context.threadContextField] : []), combined: combined, additionalRules: [context.factAngleRule])
        return GeminiGroundingPlan(prompt: prompt, evidenceBySlot: evidenceBySlot)
    }

    private func generationGroups<T>(_ values: [T], maxCount: Int) -> [[T]] {
        guard maxCount > 0 else { return values.map { [$0] } }
        return stride(from: 0, to: values.count, by: maxCount).map { Array(values[$0..<min($0 + maxCount, values.count)]) }
    }

    private func groundingGroups(_ slots: [GeminiGenerationSlot], sentenceCount: Int, priorClaims: [[String: Any]] = [], context: GenerationPromptContext = GenerationPromptContext()) -> [[GeminiGenerationSlot]] {
        let maxCount = 10
        var groups: [[GeminiGenerationSlot]] = []
        var current: [GeminiGenerationSlot] = []
        for slot in slots {
            let proposed = current + [slot]
            if !current.isEmpty && (current.count >= maxCount || groundingPrompt(slots: proposed, sentenceCount: sentenceCount, priorClaims: priorClaims, context: context).prompt.count > 48_000) {
                groups.append(current)
                current = []
            }
            current.append(slot)
        }
        if !current.isEmpty { groups.append(current) }
        return groups
    }

    private func candidateNoveltyRecord(_ candidate: GeminiCandidate, slot: GeminiGenerationSlot, round: Int) -> [String: Any] {
        ["id": "candidate-\(round)-\(slot.index)", "title": candidate.title ?? "", "claim": candidate.claim ?? "", "body": "", "topicPath": candidate.topicPath ?? slot.path]
    }

    private func generateCandidates(key: String, slots: [GeminiGenerationSlot], sentenceCount: Int, attempt: Int, avoid: [[String: Any]], priorClaims: [[String: Any]], allowStreamPrefetch: Bool, context: GenerationPromptContext = GenerationPromptContext()) async -> GeminiCandidateGroupResult {
        var requestOutcomes: [[String: Any]] = []
        let parser = JSONArrayItemStreamParser(property: "facts")
        let schema = candidateSchema(slotCount: slots.count)
        let fields = schema["properties"] as? [String: Any] ?? [:]
        let itemSchema = (fields["facts"] as? [String: Any])?["items"] as? [String: Any] ?? [:]
        var prefetched: [Int: (identity: String, task: Task<[[String: Any]], Never>)] = [:]
        var streamedNoveltyCandidates: [[String: Any]] = []
        let historicalNovelty = allowStreamPrefetch ? FactNoveltyIndex(avoid) : nil
        func identity(_ candidate: GeminiCandidate) -> String {
            [candidate.title ?? "", candidate.claim ?? "", candidate.topicPath?.joined(separator: "\u{0}") ?? "", candidate.wikipediaSearchTitles?.joined(separator: "\u{0}") ?? ""].joined(separator: "\u{1}")
        }
        do {
            let result = try await structured(key: key, prompt: candidatePrompt(slots: slots, attempt: attempt, priorClaims: priorClaims, context: context), schema: schema, stage: "candidate", maxOutputTokens: max(4096, slots.map(\.candidateOutputFloor).max() ?? 0), streaming: true, onStreamAttemptStart: {
                parser.reset()
                prefetched.values.forEach { $0.task.cancel() }
                prefetched.removeAll()
                streamedNoveltyCandidates.removeAll()
            }, onStreamText: { fragment in
                for object in parser.append(fragment) {
                    guard allowStreamPrefetch else { continue }
                    guard let normalized = StructuredResponse.normalize(object, schema: itemSchema),
                          let data = try? JSONSerialization.data(withJSONObject: normalized),
                          let candidate = try? JSONDecoder().decode(GeminiCandidate.self, from: data),
                          let slotIndex = candidate.slot,
                          let slot = slots.first(where: { $0.index == slotIndex }),
                          candidate.title?.isEmpty == false, candidate.claim?.isEmpty == false,
                          FactSpecificity.reason(candidate.claim ?? "") == nil,
                          self.topicPathMatches(candidate.topicPath, assigned: slot.path),
                          prefetched[slotIndex] == nil else { continue }
                    let noveltyRecord = self.candidateNoveltyRecord(candidate, slot: slot, round: attempt)
                    if historicalNovelty?.findDuplicate(noveltyRecord) != nil || streamedNoveltyCandidates.contains(where: { FactQuality.repeated(noveltyRecord, $0) }) {
                        continue
                    }
                    streamedNoveltyCandidates.append(noveltyRecord)
                    let lookup = WikipediaLookup(slot: slotIndex, title: candidate.title!, searchTitles: candidate.wikipediaSearchTitles ?? [], claim: candidate.claim!, difficulty: slot.level, topicPath: slot.path)
                    prefetched[slotIndex] = (identity(candidate), Task { await self.wikipedia.resolveBatch([lookup])[slotIndex] ?? [] })
                }
            })
            requestOutcomes = result.outcomes
            let envelope = try JSONDecoder().decode(GeminiCandidateEnvelope.self, from: Data(result.text.utf8))
            let facts = envelope.facts ?? []
            var candidates: [Int: GeminiCandidate] = [:]
            var sources: [Int: [[String: Any]]] = [:]
            for slot in slots {
                let matches = facts.filter { $0.slot == slot.index }
                if matches.count == 1, let fact = matches.first {
                    candidates[slot.index] = fact
                    if let pending = prefetched[slot.index], pending.identity == identity(fact) { sources[slot.index] = await pending.task.value }
                }
            }
            return GeminiCandidateGroupResult(slots: slots.map(\.index), candidates: candidates, sources: sources, outcomes: result.outcomes, error: nil, status: nil)
        } catch {
            let failure = error as? NativeError
            prefetched.values.forEach { $0.task.cancel() }
            return GeminiCandidateGroupResult(slots: slots.map(\.index), candidates: [:], sources: [:], outcomes: failure?.outcomes ?? requestOutcomes, error: failure?.message ?? "Gemini returned an unusable candidate batch.", status: failure?.status)
        }
    }

    private func combinedSchema(sentenceCount: Int, combined: Bool) -> [String: Any] {
        var schema = groundedSchema(sentenceCount: sentenceCount)
        if combined, var properties = schema["properties"] as? [String: Any], var facts = properties["facts"] as? [String: Any], var items = facts["items"] as? [String: Any], var fields = items["properties"] as? [String: Any] {
            fields["topicPath"] = ["type":"ARRAY","items":["type":"STRING"]]
            items["properties"] = fields
            items["required"] = (items["required"] as? [String] ?? []) + ["topicPath"]
            facts["items"] = items; properties["facts"] = facts; schema["properties"] = properties
        }
        return schema
    }

    private func cachedSlots(_ slots: [GeminiGenerationSlot], sentenceCount: Int, avoid: [[String: Any]], priorClaims: [[String: Any]], context: GenerationPromptContext = GenerationPromptContext()) async -> [GeminiGenerationSlot]? {
        var prepared: [GeminiGenerationSlot] = [], reserved = Set<String>()
        let usedQuotes = Set(avoid.flatMap { ($0["evidence"] as? [Any] ?? []).compactMap { entry -> String? in
            (entry as? String) ?? (entry as? [String: Any])?["quote"] as? String
        }.map(FactQuality.normalized) })
        for slot in slots {
            let sources = await validatedEvidence.sources(slot)
            var chosen: [String: Any]?
            for source in sources {
                for span in evidenceSpans(source, sourceIndex: 0) {
                    let sentenceEnds = span.quote.components(separatedBy: CharacterSet(charactersIn: ".!?")).count - 1
                    if reserved.contains(span.key) || usedQuotes.contains(FactQuality.normalized(span.quote)) || span.quote.count < sentenceCount * 35 || sentenceEnds < min(sentenceCount,3) { continue }
                    var copy = source; copy["extract"] = "[Section: \(span.section)]\n\(span.quote)"
                    chosen = copy; reserved.insert(span.key); break
                }
                if chosen != nil { break }
            }
            guard let chosen else { return nil }
            var copy = slot; copy.mode = "combined"; copy.sources = [chosen]; prepared.append(copy)
        }
        guard prepared.count <= 10, groundingPrompt(slots: prepared, sentenceCount: sentenceCount, combined: true, priorClaims: priorClaims, context: context).prompt.count <= 48_000 else { return nil }
        return prepared
    }

    private func generateGrounded(key: String, slots: [GeminiGenerationSlot], sentenceCount: Int, combined: Bool = false, priorClaims: [[String: Any]] = [], context: GenerationPromptContext = GenerationPromptContext()) async -> GeminiGroundedGroupResult {
        var requestOutcomes: [[String: Any]] = []
        do {
            let plan = groundingPrompt(slots: slots, sentenceCount: sentenceCount, combined: combined, priorClaims: priorClaims, context: context)
            let outputTokens = min(OutputCapacity.maximum, max(8192, slots.count * sentenceCount * 500, slots.map(\.groundingOutputFloor).max() ?? 0))
            let result = try await structured(key: key, prompt: plan.prompt, schema: combinedSchema(sentenceCount: sentenceCount, combined: combined), stage: "grounding", maxOutputTokens: outputTokens)
            requestOutcomes = result.outcomes
            let envelope = try JSONDecoder().decode(GeminiGroundedEnvelope.self, from: Data(result.text.utf8))
            let facts = envelope.facts ?? []
            var mapped: [Int: GeminiGroundedFact] = [:]
            for slot in slots {
                let matches = facts.filter { $0.slot == slot.index }
                if matches.count == 1, let fact = matches.first { mapped[slot.index] = fact }
            }
            return GeminiGroundedGroupResult(slots: slots.map(\.index), facts: mapped, evidenceBySlot: plan.evidenceBySlot, model: result.model, resolvedModel: result.resolvedModel, outcomes: result.outcomes, error: nil, status: nil)
        } catch {
            let failure = error as? NativeError
            return GeminiGroundedGroupResult(slots: slots.map(\.index), facts: [:], evidenceBySlot: [:], model: nil, resolvedModel: nil, outcomes: failure?.outcomes ?? requestOutcomes, error: failure?.message ?? "Gemini returned an unusable grounded batch.", status: failure?.status)
        }
    }

    private func topicPathMatches(_ proposed: [String]?, assigned: [String]) -> Bool {
        guard let proposed, proposed.count >= assigned.count else { return false }
        return assigned.enumerated().allSatisfy { index, value in proposed[index].trimmingCharacters(in: .whitespacesAndNewlines).caseInsensitiveCompare(value) == .orderedSame }
    }

    private func makeCard(slot: GeminiGenerationSlot, fact: GeminiGroundedFact, evidenceByID: [String: GeminiEvidence], sentenceCount: Int, model: String?, resolvedModel: String?) throws -> [String: Any] {
        let suppliedIDs = (fact.claimEvidenceIds ?? []) + (fact.evidence ?? []).flatMap { $0.evidenceIds ?? [] }
        guard suppliedIDs.allSatisfy({ evidenceByID[$0] != nil }) else {
            throw NativeError(message: "The card referenced an unknown evidence ID or an ID assigned to another card.")
        }
        guard fact.status == "grounded", FactQuality.validEvidenceReferences([(0, fact.claimEvidenceIds)], assignedIDs: Set(evidenceByID.keys), sentenceCount: sentenceCount) else {
            throw NativeError(message: "The card is missing valid evidence IDs supporting its specific main claim.")
        }
        guard let title = fact.title, let hook = fact.hook, let claim = fact.claim,
              let sentences = fact.sentences, let references = fact.evidence,
              !references.isEmpty else {
            throw NativeError(message: "The fact did not contain \(sentenceCount) supported sentences with matching headings.")
        }
        if let reason = FactSpecificity.reason(claim, sentences: sentences) {
            throw NativeError(message: reason)
        }
        guard FactQuality.validEvidenceReferences(references.map { ($0.sentence, $0.evidenceIds) }, assignedIDs: Set(evidenceByID.keys), sentenceCount: sentences.count) else {
            throw NativeError(message: "The card returned invalid evidence references, an unknown ID, or an ID assigned to another card.")
        }
        let sentenceEvidenceIDs = Set(references.flatMap { $0.evidenceIds ?? [] })
        guard (fact.claimEvidenceIds ?? []).allSatisfy({ sentenceEvidenceIDs.contains($0) }) else {
            throw NativeError(message: "The card’s main claim evidence is missing from its sentence citations.")
        }
        let quotes: [GeminiEvidence] = try references.flatMap { reference in
            try (reference.evidenceIds ?? []).map { id -> GeminiEvidence in
                guard let match = evidenceByID[id] else { throw NativeError(message: "The card referenced unassigned evidence.") }
                return GeminiEvidence(sentence: reference.sentence, sourceIndex: match.sourceIndex, quote: match.quote, section: match.section)
            }
        }
        guard FactQuality.validate(title: title, hook: hook, claim: claim, sentences: sentences, evidence: quotes.map { $0.dictionary }, sources: slot.sources, expectedSentences: sentenceCount, difficulty: slot.level, claimEvidence: (fact.claimEvidenceIds ?? []).compactMap { evidenceByID[$0]?.quote }) else {
            throw NativeError(message: "The fact did not contain \(sentenceCount) supported sentences with matching headings.")
        }
        let indexes = Array(Set(quotes.map(\.sourceIndex))).sorted()
        let selectedSources = indexes.map { slot.sources[$0] }
        let linkedSources = selectedSources.enumerated().map { selectedIndex, original -> [String: Any] in
            var source = original
            if let quote = quotes.first(where: { $0.sourceIndex == indexes[selectedIndex] })?.quote, let url = source["url"] as? String {
                source["canonicalUrl"] = source["canonicalUrl"] as? String ?? url
                source["url"] = WikipediaClient.evidenceLink(url, quote: quote)
            }
            return source
        }
        let remappedQuotes = quotes.map { quote -> [String: Any] in
            var value: [String: Any] = ["sentence": quote.sentence, "sourceIndex": indexes.firstIndex(of: quote.sourceIndex)!, "quote": quote.quote]
            if let section = quote.section, !section.isEmpty { value["section"] = section }
            return value
        }
        let generatedAt = isoNow()
        var card: [String: Any] = ["id": "gemini-\(UUID().uuidString)", "title": title, "hook": hook, "body": sentences.joined(separator: " "), "sentences": sentences, "sentenceCount": sentenceCount, "claim": claim, "evidence": remappedQuotes, "topicPath": slot.path, "sources": linkedSources, "difficulty": slot.level, "accent": ["blue", "lilac", "mint", "sand", "coral"][slot.index % 5], "createdAt": generatedAt, "provenance": ["provider": "gemini", "model": resolvedModel ?? model ?? "Gemini", "generatedAt": generatedAt]]
        if let questions = fact.followUpQuestions?.values, !questions.isEmpty { card["followUpQuestions"] = questions }
        if let chronology = fact.chronology?.dictionary { card["chronology"] = chronology }
        let locations = fact.locations?.compactMap(\.dictionary).prefix(2).map { $0 }
        if let locations, !locations.isEmpty { card["locations"] = locations }
        return card
    }

    func generate(key: String, topics: [[String: Any]], settings: [String: Any], avoid: [[String: Any]], requestedCount: Int = 7, rabbitHole: String? = nil, factAngle: FactAngle = .varied, onCard: @escaping ([String: Any], Int, Int, Int, String?) -> Void) async throws -> [String: Any] {
        guard !key.isEmpty else { throw NativeError(message: "Paste your Gemini API key in Settings to generate a fresh batch.", retryable: false) }
        guard !topics.isEmpty else { throw NativeError(message: "Choose a topic first.", retryable: false) }
        let context = GenerationPromptContext(surpriseMe: settings["surpriseMe"] as? Bool ?? false, rabbitHole: rabbitHole, factAngle: factAngle)
        let targetCount = max(1, min(10, requestedCount))
        let sentenceCount = FactQuality.sentenceCount(settings["sentenceLength"])
        let hasStableSlotIdentity = topics.contains { $0["slotId"] != nil }
        if hasStableSlotIdentity {
            let slotIDs = topics.compactMap { $0["slotId"] as? String }
            guard topics.count == targetCount, slotIDs.count == topics.count, Set(slotIDs).count == slotIDs.count,
                  slotIDs.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.count <= 200 }) else {
                throw NativeError(message: "The batch slot assignments could not be verified.", retryable: false)
            }
        }
        for topic in topics {
            if topic["difficulty"] != nil {
                guard let difficulty = topic["difficulty"] as? Int, (1...10).contains(difficulty) else {
                    throw NativeError(message: "A batch difficulty target is invalid.", retryable: false)
                }
            }
            if hasStableSlotIdentity {
                guard let path = topic["path"] as? [String], !path.isEmpty, path.count <= 12,
                      path.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.count <= 120 }) else {
                    throw NativeError(message: "A batch topic path could not be verified.", retryable: false)
                }
            }
        }
        let groupSize = 10
        var slots: [GeminiGenerationSlot] = (0..<targetCount).map { index in
            let topic = topics[index % topics.count]
            return GeminiGenerationSlot(index: index, slotId: topic["slotId"] as? String, path: topic["path"] as? [String] ?? [], level: max(1, min(10, topic["difficulty"] as? Int ?? settings["obscurity"] as? Int ?? 5)), mode: "candidate", candidate: nil, sources: [], lastError: nil)
        }
        var diagnostics = ValidationDiagnostics()
        let ledger = FactPublicationLedger(initial: avoid)
        var accepted: [Int: [String: Any]] = [:]
        var outcomes: [[String: Any]] = []
        var generationStatus: String?
        var providerExhausted = false
        var completed = 0

        let cached = await cachedSlots(slots, sentenceCount: sentenceCount, avoid: avoid, priorClaims: priorFactClaims(avoid, slots: slots), context: context)
        if let cached { slots = cached }
        for attempt in (cached == nil ? 0 : -1)..<3 where accepted.count < targetCount && !providerExhausted {
            try Task.checkCancellation()
            var candidateClaimsThisRound: [[String: Any]] = []
            let currentHistory = avoid + accepted.keys.sorted().compactMap { accepted[$0] }
            let pendingCandidates = slots.filter { $0.mode == "candidate" && accepted[$0.index] == nil }
            let candidateGroups = generationGroups(pendingCandidates, maxCount: pendingCandidates.contains(where: { $0.candidateOutputFloor == OutputCapacity.maximum }) ? 1 : groupSize)
            let candidateResults = await withTaskGroup(of: GeminiCandidateGroupResult.self, returning: [GeminiCandidateGroupResult].self) { group in
                for batch in candidateGroups {
                    let priorClaims = priorFactClaims(currentHistory, slots: batch)
                    group.addTask { await self.generateCandidates(key: key, slots: batch, sentenceCount: sentenceCount, attempt: attempt, avoid: currentHistory, priorClaims: priorClaims, allowStreamPrefetch: candidateGroups.count == 1, context: context) }
                }
                var results: [GeminiCandidateGroupResult] = []
                for await result in group { results.append(result) }
                return results
            }
            try Task.checkCancellation()
            for result in candidateResults.sorted(by: { ($0.slots.first ?? .max) < ($1.slots.first ?? .max) }) {
                outcomes.append(contentsOf: result.outcomes)
                if result.outcomes.contains(where: { $0["status"] as? String == "success" }) { generationStatus = "connected" }
                if let status = result.status { generationStatus = status; providerExhausted = true }
                if let error = result.error, isCredentialFailure(error) { throw NativeError(message: error, retryable: false, outcomes: outcomes, status: "invalid") }
                for index in result.slots {
                    if let slotIndex = slots.firstIndex(where: { $0.index == index }) {
                        slots[slotIndex].candidateOutputFloor = max(slots[slotIndex].candidateOutputFloor, OutputCapacity.truncatedFloor(result.outcomes))
                    }
                    guard let candidate = result.candidates[index], let title = candidate.title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty,
                          let claim = candidate.claim?.trimmingCharacters(in: .whitespacesAndNewlines), !claim.isEmpty,
                          let slotIndex = slots.firstIndex(where: { $0.index == index }), topicPathMatches(candidate.topicPath, assigned: slots[slotIndex].path) else {
                        if let slotIndex = slots.firstIndex(where: { $0.index == index }) { slots[slotIndex].lastError = result.error ?? diagnostics.record(operation: "candidate", slot: index, detail: "Gemini omitted a slot or returned a candidate for a different topic.") }
                        continue
                    }
                    if let reason = FactSpecificity.reason(claim) {
                        slots[slotIndex].lastError = diagnostics.record(operation: "candidate", slot: index, detail: reason)
                        slots[slotIndex].mode = "candidate"
                        slots[slotIndex].candidate = nil
                        slots[slotIndex].sources = []
                        continue
                    }
                    let noveltyRecord = candidateNoveltyRecord(candidate, slot: slots[slotIndex], round: attempt)
                    if await ledger.isDuplicate(noveltyRecord) || candidateClaimsThisRound.contains(where: { FactQuality.repeated(noveltyRecord, $0) }) {
                        slots[slotIndex].lastError = diagnostics.record(operation: "candidate", slot: index, detail: "This candidate repeats a fact already covered in your history or this batch.")
                        slots[slotIndex].mode = "candidate"
                        slots[slotIndex].candidate = nil
                        slots[slotIndex].sources = []
                        continue
                    }
                    candidateClaimsThisRound.append(noveltyRecord)
                    slots[slotIndex].candidate = candidate
                    slots[slotIndex].sources = result.sources[index] ?? []
                    slots[slotIndex].mode = "grounding"
                }
            }

            let lookupSlots = slots.filter { $0.mode == "grounding" && $0.sources.isEmpty && accepted[$0.index] == nil }
            let lookups = lookupSlots.compactMap { slot -> WikipediaLookup? in
                guard let candidate = slot.candidate, let title = candidate.title, let claim = candidate.claim else { return nil }
                return WikipediaLookup(slot: slot.index, title: title, searchTitles: candidate.wikipediaSearchTitles ?? [], claim: claim, difficulty: slot.level, topicPath: slot.path)
            }
            let resolved = await wikipedia.resolveBatch(lookups)
            for slotIndex in slots.indices where slots[slotIndex].mode == "grounding" && slots[slotIndex].sources.isEmpty {
                slots[slotIndex].sources = resolved[slots[slotIndex].index] ?? []
                if slots[slotIndex].sources.isEmpty {
                    slots[slotIndex].mode = "candidate"
                    slots[slotIndex].candidate = nil
                    slots[slotIndex].lastError = "Wikipedia returned no usable evidence for this candidate."
                }
            }

            if providerExhausted { break }
            let readyToGround = slots.filter { ($0.mode == "grounding" || $0.mode == "combined") && !$0.sources.isEmpty && accepted[$0.index] == nil }
            let priorGroundingClaims = priorFactClaims(currentHistory, slots: readyToGround)
            let groundingBatches = groundingGroups(readyToGround, sentenceCount: sentenceCount, priorClaims: priorGroundingClaims, context: context).flatMap { batch in
                batch.contains(where: { $0.groundingOutputFloor == OutputCapacity.maximum }) ? batch.map { [$0] } : [batch]
            }
            var groundedCredentialError: String?
            await withTaskGroup(of: GeminiGroundedGroupResult.self) { group in
                for batch in groundingBatches {
                    let priorClaims = priorFactClaims(currentHistory, slots: batch)
                    group.addTask { await self.generateGrounded(key: key, slots: batch, sentenceCount: sentenceCount, combined: attempt < 0, priorClaims: priorClaims, context: context) }
                }
                for await result in group {
                    if Task.isCancelled { group.cancelAll(); break }
                    outcomes.append(contentsOf: result.outcomes)
                    if result.outcomes.contains(where: { $0["status"] as? String == "success" }) { generationStatus = "connected" }
                    if let status = result.status { generationStatus = status; providerExhausted = true }
                    if let error = result.error, isCredentialFailure(error) { groundedCredentialError = error; group.cancelAll(); break }
                    for index in result.slots {
                        if let slotIndex = slots.firstIndex(where: { $0.index == index }) {
                            slots[slotIndex].groundingOutputFloor = max(slots[slotIndex].groundingOutputFloor, OutputCapacity.truncatedFloor(result.outcomes))
                        }
                        guard let slotIndex = slots.firstIndex(where: { $0.index == index }), let fact = result.facts[index] else {
                            if let slotIndex = slots.firstIndex(where: { $0.index == index }) {
                                slots[slotIndex].lastError = result.error ?? diagnostics.record(operation: "grounding", slot: index, detail: "Gemini omitted this grounded slot.")
                                if attempt != 0 { slots[slotIndex].mode = "candidate"; slots[slotIndex].candidate = nil; slots[slotIndex].sources = [] }
                            }
                            continue
                        }
                        if fact.status == "needs_evidence" {
                            slots[slotIndex].lastError = diagnostics.record(operation: "grounding", slot: index, detail: "The supplied passages do not support this card’s specific main claim; more evidence is needed.")
                            slots[slotIndex].mode = "candidate"
                            slots[slotIndex].candidate = nil
                            slots[slotIndex].sources = []
                            continue
                        }
                        if fact.status == "angle_unavailable" {
                            let detail = fact.missingEvidence?.trimmingCharacters(in: .whitespacesAndNewlines)
                            slots[slotIndex].lastError = diagnostics.record(operation: "grounding", slot: index, detail: detail?.isEmpty == false ? detail! : "The supplied evidence cannot support a main fact that fits the \(factAngle.label) angle.")
                            slots[slotIndex].mode = "candidate"
                            slots[slotIndex].candidate = nil
                            slots[slotIndex].sources = []
                            continue
                        }
                        if fact.status == "duplicate" {
                            slots[slotIndex].lastError = diagnostics.record(operation: "grounding", slot: index, detail: "Gemini identified this as a repeat of \(fact.duplicateOf ?? "another covered fact").")
                            slots[slotIndex].mode = "candidate"
                            slots[slotIndex].candidate = nil
                            slots[slotIndex].sources = []
                            continue
                        }
                        do {
                            if attempt < 0 && !topicPathMatches(fact.topicPath, assigned: slots[slotIndex].path) { throw NativeError(message: "The combined card returned a different topic.") }
                            let card = try makeCard(slot: slots[slotIndex], fact: fact, evidenceByID: result.evidenceBySlot[index] ?? [:], sentenceCount: sentenceCount, model: result.model, resolvedModel: result.resolvedModel)
                            if Task.isCancelled { group.cancelAll(); break }
                            guard await ledger.accept(card) else {
                                slots[slotIndex].lastError = diagnostics.record(operation: "grounding", slot: index, detail: "This candidate repeats another completed fact.")
                                slots[slotIndex].mode = "candidate"
                                slots[slotIndex].candidate = nil
                                slots[slotIndex].sources = []
                                continue
                            }
                            await validatedEvidence.record(slots[slotIndex])
                            accepted[index] = card
                            completed += 1
                            onCard(card, slotIndex, completed, targetCount, slots[slotIndex].slotId)
                        } catch {
                            if Task.isCancelled { group.cancelAll(); break }
                            let reason = (error as? NativeError)?.message ?? "The fact failed local citation validation."
                            slots[slotIndex].lastError = diagnostics.record(operation: "grounding", slot: index, detail: reason)
                            if attempt != 0 || reason == FactSpecificity.failure { slots[slotIndex].mode = "candidate"; slots[slotIndex].candidate = nil; slots[slotIndex].sources = [] }
                        }
                    }
                }
            }
            if let groundedCredentialError { throw NativeError(message: groundedCredentialError, retryable: false, outcomes: outcomes, status: "invalid") }
            try Task.checkCancellation()
        }

        let cards = slots.compactMap { accepted[$0.index] }
        let failed = targetCount - cards.count
        guard !cards.isEmpty else {
            throw NativeError(message: slots.first(where: { accepted[$0.index] == nil })?.lastError ?? "Gemini could not complete a Wikipedia-grounded batch.", retryable: generationStatus == "rate-limited", outcomes: outcomes, status: generationStatus, validationDiagnostics: diagnostics.snapshot)
        }
        let slotMappings: [[String: String]] = slots.compactMap { slot in
            guard let slotId = slot.slotId, let card = accepted[slot.index], let cardId = card["id"] as? String else { return nil }
            return ["slotId": slotId, "cardId": cardId]
        }
        return ["cards": cards, "slotMappings": slotMappings, "validationDiagnostics": diagnostics.snapshot, "requestedCount": targetCount, "completedCount": cards.count, "modelOutcomes": outcomes, "modelStatus": generationStatus ?? "connected", "partial": failed > 0, "failedJobs": failed, "retryable": failed > 0, "retryGuidance": failed > 0 ? "\(cards.count) facts arrived. Retry to find supported facts for the remaining slots." : ""]
    }

    private func glossary(key: String, card: [String: Any]) async throws -> [String: Any] {
        let originalSources = Array((card["sources"] as? [[String: Any]] ?? []).prefix(3))
        let originalEvidence = card["evidence"] as? [[String: Any]] ?? []
        var sources: [[String: Any]] = []
        var evidence: [[String: Any]] = []
        for (originalIndex, original) in originalSources.enumerated() {
            try Task.checkCancellation()
            guard let title = original["title"] as? String, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
            let url = original["canonicalUrl"] as? String ?? (original["url"] as? String ?? "")
            var extract = original["extract"] as? String ?? ""
            if extract.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                extract = originalEvidence.filter { ($0["sourceIndex"] as? Int) == originalIndex }.map { item in
                    let section = item["section"] as? String
                    let quote = item["quote"] as? String ?? ""
                    return section.map { "[Section: \($0)]\n\(quote)" } ?? quote
                }.filter { !$0.isEmpty }.joined(separator: "\n\n")
            }
            if extract.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
               let article = await wikipedia.article(title: title) {
                extract = article["extract"] as? String ?? ""
            }
            guard !extract.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
            let index = sources.count
            sources.append(["title": title, "url": url, "canonicalUrl": url])
            evidence.append(["index": index, "title": title, "extract": String(extract.prefix(12_000))])
        }
        guard !sources.isEmpty else { throw NativeError(message: "The cited Wikipedia passages could not be loaded to explain these terms.", retryable: true) }

        let cardIdentity: [String: Any] = [
            "topicPath": card["topicPath"] as? [String] ?? [], "hook": card["hook"] as? String ?? "",
            "title": card["title"] as? String ?? "", "body": card["body"] as? String ?? "",
            "claim": card["claim"] as? String ?? ""
        ]
        let prompt = PromptBuilder.learning(action: .glossary, card: cardIdentity, evidence: evidence)
        let entrySchema: [String: Any] = ["type": "OBJECT", "properties": [
            "term": ["type": "STRING"], "definition": ["type": "STRING"],
            "citationIndexes": ["type": "ARRAY", "items": ["type": "INTEGER"]]
        ], "required": ["term", "definition", "citationIndexes"]]
        let schema: [String: Any] = ["type": "OBJECT", "properties": ["entries": ["type": "ARRAY", "maxItems": 3, "items": entrySchema]], "required": ["entries"]]
        let result = try await structured(key: key, prompt: prompt, schema: schema, stage: "learning", maxOutputTokens: 1024,
            identity: try RequestIdentity.data(task: "glossary", topics: cardIdentity["topicPath"] ?? [], context: ["card": cardIdentity, "evidence": evidence, "sourceUrls": sources.map { $0["canonicalUrl"] as? String ?? "" }]))
        let envelope = try JSONDecoder().decode(GeminiGlossaryEnvelope.self, from: Data(result.text.utf8))
        let visibleText = [cardIdentity["title"] as? String ?? "", cardIdentity["hook"] as? String ?? "", cardIdentity["body"] as? String ?? ""].joined(separator: " ")
        let wordRegex = try! NSRegularExpression(pattern: #"[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*"#)
        let sentenceRegex = try! NSRegularExpression(pattern: #"[.!?]["'”’)]*(?:\s|$)"#)
        var seen = Set<String>()
        let entries: [[String: Any]] = (envelope.entries ?? []).prefix(12).compactMap { raw in
            guard let term = raw.term?.trimmingCharacters(in: .whitespacesAndNewlines), !term.isEmpty, term.count <= 80,
                  let definition = raw.definition?.trimmingCharacters(in: .whitespacesAndNewlines), !definition.isEmpty,
                  definition.count <= 300 else { return nil }
            let range = NSRange(definition.startIndex..<definition.endIndex, in: definition)
            let words = wordRegex.numberOfMatches(in: definition, range: range)
            let sentences = sentenceRegex.numberOfMatches(in: definition, range: range)
            guard words <= 35, sentences <= 1 else { return nil }
            let escaped = NSRegularExpression.escapedPattern(for: term)
            guard let termRegex = try? NSRegularExpression(pattern: #"(?<![\p{L}\p{N}])"# + escaped + #"(?![\p{L}\p{N}])"#, options: [.caseInsensitive]),
                  termRegex.firstMatch(in: visibleText, range: NSRange(visibleText.startIndex..<visibleText.endIndex, in: visibleText)) != nil else { return nil }
            let key = term.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            guard seen.insert(key).inserted else { return nil }
            let citationIndexes = Array(Set((raw.citationIndexes ?? []).filter { $0 >= 0 && $0 < sources.count })).sorted().prefix(3)
            guard !citationIndexes.isEmpty else { return nil }
            return ["term": term, "definition": definition, "sourceIndexes": Array(citationIndexes)]
        }.prefix(3).map { $0 }
        return ["glossary": ["entries": entries, "sources": sources], "modelOutcomes": result.outcomes]
    }

    func learn(key: String, action: String, card: [String: Any], question: String?, detailed: Bool, history: [[String: Any]], mode: String? = nil, structure: String = "automatic", instructionPreference: String = "written") async throws -> [String: Any] {
        guard !key.isEmpty else { throw NativeError(message: "Paste your Gemini API key in Settings before using this feature.") }
        let answerStructures = ["automatic", "short-explanation", "ordered-steps", "side-by-side-comparison"]
        guard action != "question" || answerStructures.contains(structure) else { throw NativeError(message: "Choose a supported answer structure.", retryable: false) }
        guard action != "question" || ["written", "settings"].contains(instructionPreference) else { throw NativeError(message: "Choose a supported instruction priority.", retryable: false) }
        if action == "glossary" { return try await glossary(key: key, card: card) }
        if action == "adapt" && mode != "simpler" && mode != "deeper" { throw NativeError(message: "Choose a simpler or deeper explanation.", retryable: false) }
        let instructionResolution = action == "question" ? QuestionInstructionPolicy.resolve(question ?? "", detailed: detailed, structure: structure, preference: instructionPreference) : nil
        let effectiveQuestion = instructionResolution?.questionForPrompt ?? question
        let sourceTitles = (card["sources"] as? [[String: Any]] ?? []).prefix(3).compactMap { $0["title"] as? String }
        let cachedSources = (card["sources"] as? [[String: Any]] ?? []).filter { !($0["extract"] as? String ?? "").isEmpty }
        let cachedTitles = Set(cachedSources.compactMap { ($0["title"] as? String)?.lowercased() })
        var missingTitles = sourceTitles.filter { !cachedTitles.contains($0.lowercased()) }
        if cachedSources.isEmpty && missingTitles.isEmpty { missingTitles = [card["title"] as? String ?? "Wikipedia"] }
        let fetchedSources = missingTitles.isEmpty ? [] : await wikipedia.resolve(title: missingTitles[0], searchTitles: Array(missingTitles.dropFirst()))
        var sourceArray = cachedSources + fetchedSources
        let originalSources = sourceArray
        let originalURLs = Set(originalSources.compactMap { ($0["canonicalUrl"] as? String) ?? ($0["url"] as? String) })
        if action == "question", let effectiveQuestion, !effectiveQuestion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let additional = await wikipedia.resolve(title: effectiveQuestion, searchTitles: [])
            for source in additional where sourceArray.count < 5 {
                let sourceURL = (source["canonicalUrl"] as? String) ?? (source["url"] as? String)
                if !sourceArray.contains(where: { (($0["canonicalUrl"] as? String) ?? ($0["url"] as? String)) == sourceURL }) { sourceArray.append(source) }
            }
        }
        guard !sourceArray.isEmpty else { throw NativeError(message: "Wikipedia did not return the cited pages for this fact.") }
        sourceArray = sourceArray.map { original in
            var source = original
            if !originalURLs.contains((original["canonicalUrl"] as? String) ?? (original["url"] as? String ?? "")) {
                source["extract"] = FactQuality.evidence(original["extract"] as? String ?? "", focus: effectiveQuestion ?? (card["title"] as? String ?? ""), level: 5)
            }
            return source
        }
        let context: [[String: Any]] = sourceArray.prefix(5).enumerated().map { index, source in
            let url = source["canonicalUrl"] as? String ?? source["url"] as? String ?? ""
            return ["index": index, "kind": originalURLs.contains(url) ? "original" : "supplemental",
                    "title": source["title"] as? String ?? "Wikipedia", "extract": source["extract"] as? String ?? "No extract returned"]
        }
        let cardIdentity: [String: Any] = ["topicPath": card["topicPath"] as? [String] ?? [], "hook": card["hook"] as? String ?? "",
                                         "title": card["title"] as? String ?? "", "body": card["body"] as? String ?? "", "claim": card["claim"] as? String ?? ""]
        let promptAction: PromptOperation = action == "adapt" ? .adapt : action == "learn" ? .learn : .question
        let prompt = PromptBuilder.learning(action: promptAction,
            card: cardIdentity, question: question, detailed: detailed, history: history, mode: mode, structure: structure, instructionPreference: instructionPreference, evidence: context)
        let requestTask = action == "question" ? "question" : action == "adapt" ? "adapt" : "learn"
        let effectiveDetailed = instructionResolution?.effectiveDetailed ?? detailed
        let effectiveStructure = instructionResolution?.effectiveStructure ?? structure
        let requestFilters: [String: Any] = action == "question" ? ["detailed": effectiveDetailed, "structure": effectiveStructure, "structurePolicy": "answer-structure-v1", "instructionPolicy": QuestionInstructionPolicy.version, "instructionPreference": instructionPreference, "directive": instructionResolution?.directive ?? [:], "questionForPrompt": instructionResolution?.questionForPrompt ?? question ?? ""] : action == "adapt" ? ["mode": mode ?? "simpler"] : [:]
        let outputLimit = action == "adapt" ? (mode == "deeper" ? 4096 : 2048) : action == "question" ? (effectiveStructure == "short-explanation" ? 2048 : effectiveDetailed ? 8192 : 4096) : detailed ? 8192 : 4096
        let questionSchema: [String: Any] = ["type": "OBJECT", "properties": [
            "directAnswer": ["type": "STRING"],
                "answer": ["type": "STRING"],
            "resolvedStructure": ["type": "STRING"],
            "paragraphs": ["type": "ARRAY", "items": ["type": "STRING"]],
            "steps": ["type": "ARRAY", "items": ["type": "STRING"]],
            "comparisonSubjects": ["type": "ARRAY", "items": ["type": "STRING"]],
            "comparisonRows": ["type": "ARRAY", "items": ["type": "OBJECT", "properties": ["property": ["type": "STRING"], "values": ["type": "ARRAY", "items": ["type": "STRING"]]]]],
            "fallbackReason": ["type": "STRING"],
            "citationIndexes": ["type": "ARRAY", "items": ["type": "INTEGER"]]
            ], "required": ["citationIndexes"]]
        let ordinarySchema: [String: Any] = ["type": "OBJECT", "properties": ["answer": ["type": "STRING"], "citationIndexes": ["type": "ARRAY", "items": ["type": "INTEGER"]]], "required": ["answer", "citationIndexes"]]
        let result = try await structured(key: key, prompt: prompt, schema: action == "question" ? questionSchema : ordinarySchema, stage: "learning", maxOutputTokens: outputLimit, identity: try RequestIdentity.data(task: requestTask, query: action == "question" ? question : nil, topics: cardIdentity["topicPath"] ?? [], filters: requestFilters, context: ["card": cardIdentity, "history": action == "question" ? Array(history.suffix(6)) : [], "evidence": context, "sourceUrls": sourceArray.prefix(5).map { $0["canonicalUrl"] as? String ?? $0["url"] as? String ?? "" }]))
        guard let envelope = try JSONSerialization.jsonObject(with: Data(result.text.utf8)) as? [String: Any] else { throw NativeError(message: "Gemini returned an unreadable answer.") }
        let answer = action == "question" ? (envelope["directAnswer"] as? String ?? envelope["answer"] as? String) : envelope["answer"] as? String
        guard let answer, !answer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw NativeError(message: "Gemini returned an empty explanation.") }
        let citations = ((envelope["citationIndexes"] as? [Int]) ?? []).filter { $0 >= 0 && $0 < sourceArray.count }.prefix(3).map { sourceArray[$0] }
        if action == "adapt" && citations.isEmpty { throw NativeError(message: "Gemini could not support this alternate explanation with the card’s sources.") }
        var response: [String: Any] = ["citations": Array(citations.isEmpty ? Array(sourceArray.prefix(1)) : citations), "modelOutcomes": result.outcomes]
        if action == "question" {
            response["directAnswer"] = answer
            response["resolvedStructure"] = envelope["resolvedStructure"] ?? "short-explanation"
            response["paragraphs"] = envelope["paragraphs"] ?? []
            response["steps"] = envelope["steps"] ?? []
            response["comparisonSubjects"] = envelope["comparisonSubjects"] ?? []
            response["comparisonRows"] = envelope["comparisonRows"] ?? []
            response["fallbackReason"] = envelope["fallbackReason"] ?? ""
        } else { response["answer"] = answer }
        return response
    }

    func interpretVideoSearch(key: String, query: String, catalogVersion: Int) async throws -> [String: Any] {
        guard !key.isEmpty else { throw NativeError(message: "Paste your Gemini API key in Settings before using Smart search.", retryable: false) }
        let prompt = PromptBuilder.searchInterpretation(.videoInterpret, query: query)
        let schema: [String: Any] = ["type": "OBJECT", "properties": ["terms": ["type": "ARRAY", "items": ["type": "STRING"]], "include": ["type": "ARRAY", "items": ["type": "STRING"]], "alternatives": ["type": "ARRAY", "items": ["type": "STRING"]], "topics": ["type": "ARRAY", "items": ["type": "STRING"]], "conceptGroups": ["type": "ARRAY", "maxItems": 8, "items": ["type": "OBJECT", "properties": ["label": ["type": "STRING"], "terms": ["type": "ARRAY", "minItems": 1, "maxItems": 12, "items": ["type": "STRING"]], "related": ["type": "ARRAY", "maxItems": 12, "items": ["type": "STRING"]], "required": ["type": "BOOLEAN"]], "required": ["label", "terms", "related", "required"]]]], "required": ["conceptGroups", "topics"]]
        let result = try await structured(key: key, prompt: prompt, schema: schema, stage: "learning", priority: 1, allowedModels: GeminiModelPolicy.primaryModels, maxOutputTokens: 1024, cacheContext: "youtube-catalog:\(catalogVersion)", identity: try RequestIdentity.data(task: "videoInterpret", query: query))
        let envelope = try JSONDecoder().decode(GeminiVideoSearchEnvelope.self, from: Data(result.text.utf8))
        var output: [String: Any] = ["terms": Array((envelope.terms ?? []).prefix(24)), "include": Array((envelope.include ?? []).prefix(24)), "alternatives": Array((envelope.alternatives ?? []).prefix(32)), "topics": Array((envelope.topics ?? []).prefix(12))]
        if let groups = envelope.conceptGroups { output["conceptGroups"] = groups.prefix(8).map { ["label": String(($0.label ?? "").prefix(100)), "terms": Array(($0.terms ?? []).prefix(12)).map { String($0.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100)) }, "related": Array(($0.related ?? []).prefix(12)).map { String($0.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100)) }, "required": true] } }
        output["modelOutcomes"] = result.outcomes
        return output
    }

    func interpretNaturalSearch(key: String, query: String, catalogVersion: Int) async throws -> [String: Any] {
        guard !key.isEmpty else { throw NativeError(message: "Paste your Gemini API key in Settings before using natural-language search.", retryable: false) }
        let prompt = PromptBuilder.searchInterpretation(.topicInterpret, query: query)
        let list: [String: Any] = ["type": "ARRAY", "maxItems": 12, "items": ["type": "STRING"]]
        let schema: [String: Any] = ["type": "OBJECT", "properties": ["groups": ["type": "ARRAY", "maxItems": 8, "items": ["type": "OBJECT", "properties": ["label": ["type": "STRING"], "equivalents": list, "related": list], "required": ["label", "equivalents", "related"]]], "alternatives": ["type": "BOOLEAN"]], "required": ["groups", "alternatives"]]
        let result = try await structured(key: key, prompt: prompt, schema: schema, stage: "learning", priority: 1, allowedModels: GeminiModelPolicy.primaryModels, maxOutputTokens: 1024, cacheContext: "topic-catalog:\(catalogVersion)", identity: try RequestIdentity.data(task: "topicInterpret", query: query))
        let plan = try JSONSerialization.jsonObject(with: Data(result.text.utf8)) as? [String: Any] ?? [:]
        return ["plan": plan, "modelOutcomes": result.outcomes]
    }

    func rankVideoSearch(key: String, query: String, plan: [String: Any], candidates: [[String: Any]], catalogVersion: Int) async throws -> [String: Any] {
        guard !key.isEmpty else { throw NativeError(message: "Paste your Gemini API key in Settings before using Smart search.", retryable: false) }
        let bounded = Array(candidates.prefix(40))
        guard !bounded.isEmpty else { return ["results": [], "modelOutcomes": []] }
        let candidatePayload: [[String: Any]] = bounded.map { candidate in
            let video = candidate["video"] as? [String: Any] ?? [:]
            let description = (video["description"] as? String ?? "").replacingOccurrences(of: "(?:subscribe|like and subscribe|follow us|social media|patreon|sponsor(?:ed)? by|use code|affiliate|merch(?:andise)?|join the discord|business inquiries|check out my|support the channel)[^.!?]*(?:[.!?]|$)", with: " ", options: .regularExpression).replacingOccurrences(of: "https?://\\S+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines).prefix(480)
            return ["videoId": video["id"] as? String ?? "", "title": video["title"] as? String ?? "", "creator": video["channelName"] as? String ?? "", "publishedAt": video["publishedAt"] as? String ?? "", "durationSeconds": video["durationSeconds"] as? Int ?? 0, "topics": video["topics"] as? [String] ?? [], "tags": Array((video["tags"] as? [String] ?? []).prefix(16)), "descriptionExcerpt": String(description), "locallyMatchedFields": candidate["matchedFields"] as? [String] ?? [], "localSupportingText": candidate["supportingText"] as? [String] ?? []]
        }
        let prompt = PromptBuilder.build(.videoVerify, fields: [PromptField("Query", query), PromptField("Plan", plan, reference: true), PromptField("Candidates", candidatePayload, reference: true)])
        let schema: [String: Any] = ["type": "OBJECT", "properties": ["matches": ["type": "ARRAY", "items": ["type": "OBJECT", "properties": ["videoId": ["type": "STRING"], "relevance": ["type": "STRING", "enum": ["direct", "strong"]], "support": ["type": "ARRAY", "items": ["type": "STRING"]], "explanation": ["type": "STRING"]], "required": ["videoId", "relevance", "support", "explanation"]]]], "required": ["matches"]]
        let result = try await structured(key: key, prompt: prompt, schema: schema, stage: "learning", priority: 1, allowedModels: GeminiModelPolicy.primaryModels, maxOutputTokens: 4096, cacheContext: "youtube-catalog:\(catalogVersion)", identity: try RequestIdentity.data(task: "videoVerify", query: query, topics: plan["topics"] ?? [], filters: plan, context: candidatePayload))
        let envelope = try JSONDecoder().decode(GeminiVideoRankEnvelope.self, from: Data(result.text.utf8))
        let allowed = Set(candidatePayload.compactMap { $0["videoId"] as? String })
        var seen = Set<String>()
        let matches: [[String: Any]] = (envelope.matches ?? []).compactMap { match in
            guard let id = match.videoId?.trimmingCharacters(in: .whitespacesAndNewlines), allowed.contains(id), !seen.contains(id), match.relevance == "direct" || match.relevance == "strong", let explanation = match.explanation?.trimmingCharacters(in: .whitespacesAndNewlines), !explanation.isEmpty else { return nil }
            let support = Array(Set((match.support ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })).prefix(4)
            guard !support.isEmpty else { return nil }
            seen.insert(id)
            return ["videoId": id, "relevance": match.relevance!, "support": Array(support), "explanation": String(explanation.prefix(240))]
        }
        return ["results": matches, "modelOutcomes": result.outcomes]
    }
}

private final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding {
    private var window: NSWindow!
    private var webView: WKWebView!
    private let gemini = GeminiClient()
    private let keychain = KeychainStore()
    private let workspace = LocalWorkspaceStore()
    private let youtubePlaybackCheckpoints = YouTubePlaybackCheckpointStore()
    private let videoCatalog = VideoCatalogStore()
    private let youtubeImportCheckpoints = YouTubeImportCheckpointStore()
    private let youtubeLimiter = YouTubeRequestLimiter()
    private let youtubeDownloads = ConditionalDownloadCache()
    private let youtubeSession = URLSession(configuration: .ephemeral)
    private let backgroundRetries = BackgroundRetryGate()
    private var geminiKey = ""
    private var sessionRefresh: Task<CloudSession, Error>?
    private var sessionEpoch = 0
    private var authSession: ASWebAuthenticationSession?
    private var authRequestID = ""
    private var authVerifier = ""
    private var authState = ""
    private var config: [String: Any] = [:]
    private var activeTasks: [String: Task<Void, Never>] = [:]
    private var cloudSyncTasks = Set<String>()

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let configURL = Bundle.main.url(forResource: "Config", withExtension: "plist"),
           let values = NSDictionary(contentsOf: configURL) as? [String: Any] {
            config = values["LearnedMediaConfig"] as? [String: Any] ?? [:]
        }
        geminiKey = keychain.read("gemini-api-key").flatMap { String(data: $0, encoding: .utf8) } ?? ""
        let webConfiguration = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.add(self, name: "native")
        webConfiguration.userContentController = controller
        webConfiguration.preferences.setValue(true, forKey: "developerExtrasEnabled")
        webView = WKWebView(frame: .zero, configuration: webConfiguration)
        configureMainMenu()
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Learned Media"
        window.minSize = NSSize(width: 920, height: 640)
        window.contentView = webView
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        if let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "frontend") {
            webView.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        }
    }

    private func configureMainMenu() {
        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu(title: "Learned Media")
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "Quit Learned Media", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        mainMenu.addItem(appMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "Undo", action: #selector(UndoManager.undo), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: #selector(UndoManager.redo), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        mainMenu.addItem(editMenuItem)
        NSApp.mainMenu = mainMenu
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { window }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let trusted = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "frontend"), message.frameInfo.request.url?.standardizedFileURL.path == trusted.standardizedFileURL.path else { return }
        guard let body = message.body as? [String: Any], let id = body["id"] as? String, let action = body["action"] as? String else { return }
        let payload = body["payload"] as? [String: Any] ?? [:]
        switch action {
        case "credentialRead", "credentialWrite":
            guard let provider = payload["provider"] as? String, ["gemini", "youtube"].contains(provider) else { respond(id: id, error: "Invalid credential provider."); return }
            let owner = payload["owner"] as? String
            if let owner, UUID(uuidString: owner) == nil { respond(id: id, error: "Invalid credential account."); return }
            let credentialID = owner.map { "account:\($0):\(provider)" } ?? "\(provider)-api-key"
            do {
                if action == "credentialWrite" {
                    let entry = payload["entry"] as? [String: Any]
                    let data = try entry.map { try JSONSerialization.data(withJSONObject: $0) } ?? Data()
                    try keychain.save(credentialID, data: data)
                    respond(id: id, result: true)
                } else if let data = keychain.read(credentialID) {
                    if let entry = try? JSONSerialization.jsonObject(with: data) as? [String: Any] { respond(id: id, result: entry) }
                    else { respond(id: id, result: ["value": String(data: data, encoding: .utf8) ?? "", "pending": owner == nil ? NSNull() : "import"] as [String: Any]) }
                } else { respond(id: id, result: NSNull()) }
            } catch { respond(id: id, error: "The API key could not be saved in Keychain.") }
        case "useKeys":
            let key = payload["gemini"] as? String ?? ""
            if key != geminiKey { cancelActiveTasks(preserveCloudSync: true); geminiKey = key; Task { await gemini.reset() } }
            respond(id: id, result: true)
        case "currentAccount", "accountKeysLoad", "accountKeySave":
            Task { [weak self] in
                guard let self else { return }
                do {
                    let session = try await cloudSession()
                    if action == "currentAccount" {
                        let object = keychain.readSession().flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
                        let user = object["user"] as? [String: Any] ?? [:]
                        let metadata = user["user_metadata"] as? [String: Any] ?? [:]
                        respond(id: id, result: ["id": session.userID, "email": user["email"] as? String ?? "", "name": metadata["full_name"] as? String ?? user["email"] as? String ?? "Google learner"])
                    } else {
                        guard payload["owner"] as? String == session.userID else { throw NativeError(message: "Account changed. API key sync was canceled.", retryable: false) }
                        let (url, anonKey) = try cloudConfiguration()
                        var components = URLComponents(url: url.appendingPathComponent("rest/v1/account_credentials"), resolvingAgainstBaseURL: false)!
                        if action == "accountKeysLoad" {
                            components.queryItems = [URLQueryItem(name: "select", value: "provider,api_key"), URLQueryItem(name: "user_id", value: "eq.\(session.userID)")]
                            let rows = try await cloudRequest(components.url!, method: "GET", anonKey: anonKey, session: session) as? [[String: Any]] ?? []
                            var keys: [String: String] = [:]
                            for row in rows { if let provider = row["provider"] as? String, ["gemini", "youtube"].contains(provider) { keys[provider] = row["api_key"] as? String ?? "" } }
                            respond(id: id, result: keys)
                        } else {
                            guard let provider = payload["provider"] as? String, ["gemini", "youtube"].contains(provider), let value = payload["value"] as? String, value.utf8.count <= 4096 else { throw NativeError(message: "Invalid API key settings.", retryable: false) }
                            components.queryItems = [URLQueryItem(name: "on_conflict", value: "user_id,provider")]
                            _ = try await cloudRequest(components.url!, method: "POST", anonKey: anonKey, session: session, body: ["user_id": session.userID, "provider": provider, "api_key": value], prefer: "resolution=merge-duplicates,return=minimal")
                            respond(id: id, result: true)
                        }
                    }
                } catch { respond(id: id, error: "Account sync is unavailable. Reconnect to retry; your keys remain in Keychain.") }
            }
        case "performanceDiagnostics":
            if payload["reset"] as? Bool == true { PerformanceDiagnostics.shared.reset(); SnapshotValidation.reset() }
            var diagnostics = PerformanceDiagnostics.shared.snapshot()
            diagnostics["storageValidation"] = SnapshotValidation.snapshot()
            respond(id: id, result: diagnostics)
        case "loadKeys":
            respond(id: id, result: ["gemini": geminiKey, "youtube": keychain.read("youtube-api-key").flatMap { String(data: $0, encoding: .utf8) } ?? ""])
        case "setYouTubeKey":
            do { try keychain.save("youtube-api-key", data: Data((payload["key"] as? String ?? "").utf8)); respond(id: id, result: true) }
            catch { respond(id: id, error: "YouTube key could not be remembered in Keychain.") }
        case "loadState":
            respond(id: id, result: loadState())
        case "loadYouTubePlaybackCheckpoints":
            guard let ownerID = payload["ownerID"] as? String,
                  let workspaceIDs = payload["workspaceIDs"] as? [String],
                  !ownerID.isEmpty, workspaceIDs.count <= 250 else {
                respond(id: id, error: "Invalid playback checkpoint request.")
                return
            }
            if ownerID == "local" {
                respond(id: id, result: youtubePlaybackCheckpoints.checkpoints(ownerID: ownerID, workspaceIDs: workspaceIDs))
            } else {
                Task { [weak self] in
                    guard let self else { return }
                    do {
                        let session = try await cloudSession()
                        guard session.userID == ownerID else { throw NativeError(message: "Account changed. Playback restoration was canceled.", retryable: false) }
                        respond(id: id, result: youtubePlaybackCheckpoints.checkpoints(ownerID: ownerID, workspaceIDs: workspaceIDs))
                    } catch { respond(id: id, error: "Playback positions could not be restored for this account.") }
                }
            }
        case "saveYouTubePlaybackCheckpoint":
            do {
                guard let ownerID = payload["ownerID"] as? String,
                      let workspaceID = payload["workspaceID"] as? String,
                      let videoID = payload["videoID"] as? String,
                      let seconds = payload["seconds"] as? Int else { throw PlaybackCheckpointError.invalid }
                try youtubePlaybackCheckpoints.save(ownerID: ownerID, workspaceID: workspaceID, videoID: videoID, seconds: seconds)
                respond(id: id, result: true)
            } catch { respond(id: id, error: "YouTube playback position could not be saved locally.") }
        case "loadDownloadPreference":
            respond(id: id, result: UserDefaults.standard.string(forKey: "learned-media-download-mode-v1") ?? "pdf-single")
        case "saveDownloadPreference":
            let mode = payload["mode"] as? String ?? "pdf-single"
            UserDefaults.standard.set(["pdf-single", "txt-single", "pdf-folder", "txt-folder"].contains(mode) ? mode : "pdf-single", forKey: "learned-media-download-mode-v1")
            respond(id: id, result: true)
        case "loadRevealGraduallyPreference":
            respond(id: id, result: UserDefaults.standard.object(forKey: "learned-media-reveal-gradually-v1") as? Bool ?? false)
        case "saveRevealGraduallyPreference":
            UserDefaults.standard.set(payload["enabled"] as? Bool ?? false, forKey: "learned-media-reveal-gradually-v1")
            respond(id: id, result: true)
        case "loadVideoCatalog":
            Task { [weak self] in
                guard let self else { return }
                do { respond(id: id, result: try await videoCatalog.load()) }
                catch { respond(id: id, error: "The YouTube catalog could not be restored. Your import checkpoints were retained.") }
            }
        case "saveState":
            do { try saveState(payload["state"]); respond(id: id, result: true) }
            catch { respond(id: id, error: "Learning data could not be saved. The last valid recovery copy was kept.") }
        case "hasYouTubeImportPages", "loadYouTubeImportPages", "saveYouTubeImportPage", "clearYouTubeImportPages":
            Task { [weak self] in
                guard let self else { return }
                do {
                    let sourceID = payload["sourceId"] as? String ?? ""
                    if action == "hasYouTubeImportPages" { respond(id: id, result: try await youtubeImportCheckpoints.has(payload["sourceId"] as? String)) }
                    else if action == "loadYouTubeImportPages" { respond(id: id, result: try await youtubeImportCheckpoints.load(sourceID)) }
                    else if action == "clearYouTubeImportPages" { try await youtubeImportCheckpoints.clear(sourceID); respond(id: id, result: true) }
                    else {
                        guard let page = payload["page"] as? [String: Any] else { throw NativeError(message: "Invalid YouTube import page.", retryable: false) }
                        try await youtubeImportCheckpoints.save(page); respond(id: id, result: true)
                    }
                } catch { respond(id: id, error: "The YouTube import checkpoint could not be saved or restored. Retry to resume safely.") }
            }
        case "commitYouTubeImportCatalog":
            Task { [weak self] in
                guard let self else { return }
                do {
                    guard let catalog = payload["catalog"] as? [String: Any] else { throw NativeError(message: "Invalid YouTube catalog.", retryable: false) }
                    try await videoCatalog.save(catalog)
                    // Catalog replacement is durable before any staged pages retire.
                    for sourceID in payload["completedSources"] as? [String] ?? [] { try? await youtubeImportCheckpoints.clear(sourceID) }
                    respond(id: id, result: true)
                } catch { respond(id: id, error: "The YouTube catalog could not be saved. Its import checkpoints were retained.") }
            }
        case "exportFacts":
            exportFacts(id: id, payload: payload)
        case "setGeminiKey":
            cancelActiveTasks(preserveCloudSync: true)
            geminiKey = payload["key"] as? String ?? ""
            Task { await gemini.reset() }
            do { try keychain.save("gemini-api-key", data: Data(geminiKey.utf8)); respond(id: id, result: true) }
            catch { respond(id: id, error: "Gemini key could not be remembered in Keychain.") }
        case "testGemini":
            let task = Task { [weak self] in
                guard let self else { return }
                let token = payload["token"] as? Int ?? 0
                let result = await gemini.test(key: payload["key"] as? String ?? geminiKey) { [weak self] check, readyCount in
                    self?.respondEvent(id: id, payload: ["type": "modelCheck", "token": token, "check": check, "readyCount": readyCount, "requiredWorkingModels": GeminiModelPolicy.requiredWorkingModels])
                }
                respond(id: id, result: result)
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "generate":
            let topics = payload["topics"] as? [[String: Any]] ?? []
            let settings = payload["settings"] as? [String: Any] ?? [:]
            let avoid = payload["avoid"] as? [[String: Any]] ?? []
            let requestedCount = payload["requestedCount"] as? Int ?? 7
            let factAngle: FactAngle
            if let rawAngle = payload["factAngle"] {
                guard let value = rawAngle as? String, let parsed = FactAngle(rawValue: value) else {
                    respond(id: id, error: "Choose a supported fact angle before generating a batch.")
                    return
                }
                factAngle = parsed
            } else {
                factAngle = .varied
            }
            let token = payload["token"] as? Int ?? 0
            let detourID = payload["detourId"] as? String
            let detourSlots = payload["detourSlots"] as? [Int] ?? []
            let task = Task { [weak self] in
                guard let self else { return }
                do {
                    let result = try await gemini.generate(key: geminiKey, topics: topics, settings: settings, avoid: avoid, requestedCount: requestedCount, rabbitHole: payload["rabbitHole"] as? String, factAngle: factAngle) { [weak self] card, slot, completed, requested, slotId in
                        var event: [String: Any] = ["type": "generationCard", "token": token, "card": card, "completed": completed, "requested": requested]
                        event["slot"] = slot
                        if let slotId { event["slotId"] = slotId }
                        if let detourID, detourSlots.indices.contains(slot) {
                            event["detourId"] = detourID
                            event["detourSlot"] = detourSlots[slot]
                        }
                        self?.respondEvent(id: id, payload: event)
                    }
                    respond(id: id, result: result)
                }
                catch {
                    if let failure = error as? NativeError {
                        var event: [String: Any] = ["type": "generationStatus", "token": token, "modelOutcomes": failure.outcomes]
                        if let status = failure.status { event["status"] = status }
                        respondEvent(id: id, payload: event)
                    }
                    respond(id: id, error: userMessage(error))
                }
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "resolveFactImage":
            let source = payload["source"] as? [String: Any] ?? [:]
            let cardID = payload["cardId"] as? String ?? ""
            let task = Task { [weak self] in
                guard let self else { return }
                let image = await gemini.resolveImage(source: source)
                respond(id: id, result: ["cardId": cardID, "image": image.map { $0 as Any } ?? NSNull()])
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "wikipediaArticle":
            let title = payload["title"] as? String ?? ""
            let task = Task { [weak self] in
                guard let self else { return }
                let article = await gemini.wikipediaArticle(title: title)
                guard !Task.isCancelled else { return }
                respond(id: id, result: article.map { $0 as Any } ?? NSNull())
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "wikipediaCoordinates":
            let titles = payload["titles"] as? [String] ?? []
            let task = Task { [weak self] in
                guard let self else { return }
                if let places = await gemini.wikipediaCoordinates(titles: titles) { respond(id: id, result: places) }
                else { respond(id: id, error: "Wikipedia location details could not be loaded.") }
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "countryOutlineData":
            guard let url = Bundle.main.url(forResource: "country-outlines", withExtension: "json", subdirectory: "frontend"),
                  let data = try? Data(contentsOf: url),
                  let outlines = try? JSONSerialization.jsonObject(with: data) else {
                respond(id: id, error: "The bundled country outlines could not be loaded.")
                return
            }
            respond(id: id, result: outlines)
        case "learn":
            let card = payload["card"] as? [String: Any] ?? [:]
            let actionName = payload["action"] as? String ?? "learn"
            let question = payload["question"] as? String
            let detailed = payload["detailed"] as? Bool ?? false
            let history = payload["history"] as? [[String: Any]] ?? []
            let mode = payload["mode"] as? String
            let structure = payload["structure"] as? String ?? "automatic"
            let task = Task { [weak self] in
                guard let self else { return }
                let instructionPreference = payload["instructionPreference"] as? String ?? "written"
                do { respond(id: id, result: try await gemini.learn(key: geminiKey, action: actionName, card: card, question: question, detailed: detailed, history: history, mode: mode, structure: structure, instructionPreference: instructionPreference)) }
                catch { respondGeminiFailure(id: id, error: error) }
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "youtubeRequest":
            let resource = payload["resource"] as? String ?? ""
            let key = payload["key"] as? String ?? ""
            let params = payload["params"] as? [String: Any] ?? [:]
            let task = Task { [weak self] in
                guard let self else { return }
                do { respond(id: id, result: try await youtubeRequest(resource: resource, key: key, params: params)) }
                catch { respond(id: id, error: userMessage(error)) }
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "videoSearch":
            let query = payload["query"] as? String ?? ""
            let key = payload["key"] as? String ?? geminiKey
            let catalogVersion = payload["catalogVersion"] as? Int ?? 0
            let task = Task { [weak self] in
                guard let self else { return }
                do { respond(id: id, result: try await gemini.interpretVideoSearch(key: key, query: query, catalogVersion: catalogVersion)) }
                catch { respondGeminiFailure(id: id, error: error) }
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "searchInterpret":
            let query = payload["query"] as? String ?? ""
            let key = payload["key"] as? String ?? geminiKey
            let catalogVersion = payload["catalogVersion"] as? Int ?? 0
            let task = Task { [weak self] in
                guard let self else { return }
                do { respond(id: id, result: try await gemini.interpretNaturalSearch(key: key, query: query, catalogVersion: catalogVersion)) }
                catch { respondGeminiFailure(id: id, error: error) }
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "videoSearchRank":
            let query = payload["query"] as? String ?? ""
            let key = payload["key"] as? String ?? geminiKey
            let plan = payload["plan"] as? [String: Any] ?? [:]
            let candidates = payload["candidates"] as? [[String: Any]] ?? []
            let catalogVersion = payload["catalogVersion"] as? Int ?? 0
            let task = Task { [weak self] in
                guard let self else { return }
                do { respond(id: id, result: try await gemini.rankVideoSearch(key: key, query: query, plan: plan, candidates: candidates, catalogVersion: catalogVersion)) }
                catch { respondGeminiFailure(id: id, error: error) }
                activeTasks[id] = nil
            }
            activeTasks[id] = task
        case "cancelRequest":
            if let taskID = payload["taskId"] as? String {
                activeTasks[taskID]?.cancel()
                activeTasks[taskID] = nil
                cloudSyncTasks.remove(taskID)
                respond(id: taskID, error: "Request canceled.")
            }
            respond(id: id, result: true)
        case "cancelAll":
            // Workspace/key/search changes do not cancel account-level cloud sync.
            cancelActiveTasks(preserveCloudSync: true)
            respond(id: id, result: true)
        case "openURL":
            if let raw = payload["url"] as? String, let url = URL(string: raw), allowedExternal(url) { NSWorkspace.shared.open(url) }
            respond(id: id, result: true)
        case "signIn":
            signIn(id: id)
        case "signOut":
            authSession?.cancel()
            authSession = nil
            cancelActiveTasks()
            sessionEpoch += 1
            sessionRefresh?.cancel()
            sessionRefresh = nil
            geminiKey = ""
            keychain.deleteSession()
            respond(id: id, result: true)
        case "cloudLoad":
            cloudSyncTasks.insert(id)
            let task = Task { [weak self] in
                guard let self else { return }
                do { respond(id: id, result: try await cloudLoad()) }
                catch { respond(id: id, error: userMessage(error)) }
                activeTasks[id] = nil
                cloudSyncTasks.remove(id)
            }
            activeTasks[id] = task
        case "cloudSave":
            let cloudState = payload["state"]
            cloudSyncTasks.insert(id)
            let task = Task { [weak self] in
                guard let self else { return }
                do { respond(id: id, result: try await cloudSave(cloudState)) }
                catch { respond(id: id, error: userMessage(error)) }
                activeTasks[id] = nil
                cloudSyncTasks.remove(id)
            }
            activeTasks[id] = task
        default:
            respond(id: id, error: "That application action is not available.")
        }
    }

    private func allowedExternal(_ url: URL) -> Bool {
        guard url.scheme == "https" else { return false }
        let host = url.host ?? ""
        return host == "aistudio.google.com" || host == "console.cloud.google.com" || host == "www.youtube.com" || host == "youtube.com" || host.hasSuffix(".wikipedia.org") || host.hasSuffix(".wikimedia.org") || host.hasSuffix(".supabase.co")
    }

    private func cloudConfiguration() throws -> (URL, String) {
        guard let rawURL = config["SupabaseURL"] as? String, let url = URL(string: rawURL),
              let key = config["SupabasePublishableKey"] as? String, !key.isEmpty else {
            throw NativeError(message: "Cloud sync is not configured for this app. Your workspace remains local.", retryable: false)
        }
        return (url, key)
    }

    private func cloudNow() -> String { NativeDateFormatting.iso8601UTC.format(Date()) }

    private func cloudSession() async throws -> CloudSession {
        if let pending = sessionRefresh { return try await pending.value }
        let epoch = sessionEpoch
        let task = Task { try await self.refreshCloudSession() }
        sessionRefresh = task
        defer { if sessionEpoch == epoch { sessionRefresh = nil } }
        return try await task.value
    }

    private func refreshCloudSession() async throws -> CloudSession {
        try Task.checkCancellation()
        let epoch = sessionEpoch
        let (supabaseURL, anonKey) = try cloudConfiguration()
        guard let data = keychain.readSession(), let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let accessToken = object["access_token"] as? String, let refreshToken = object["refresh_token"] as? String else {
            throw NativeError(message: "Sign in with Google before syncing this Mac.", retryable: false)
        }
        let expiresAt = (object["expires_at"] as? NSNumber)?.doubleValue ?? 0
        if expiresAt > Date().timeIntervalSince1970 + 90 {
            let userID = (object["user"] as? [String: Any])?["id"] as? String ?? ""
            if !userID.isEmpty { return CloudSession(accessToken: accessToken, userID: userID) }
        }
        var components = URLComponents(url: supabaseURL.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
        let (refreshedData, response) = try await URLSession(configuration: .ephemeral).data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode), let refreshed = try? JSONSerialization.jsonObject(with: refreshedData) as? [String: Any], let token = refreshed["access_token"] as? String else {
            throw NativeError(message: "Your Google session expired. Sign in again to resume cloud sync.", retryable: false)
        }
        try Task.checkCancellation()
        guard epoch == sessionEpoch else { throw CancellationError() }
        try keychain.saveSession(normalizedSessionData(refreshedData))
        let userID = (refreshed["user"] as? [String: Any])?["id"] as? String ?? (object["user"] as? [String: Any])?["id"] as? String ?? ""
        guard !userID.isEmpty else { throw NativeError(message: "The Google session did not include an account ID.", retryable: false) }
        return CloudSession(accessToken: token, userID: userID)
    }

    private func cloudRequest(_ url: URL, method: String, anonKey: String, session: CloudSession, body: Any? = nil, prefer: String? = nil) async throws -> Any {
        var request = URLRequest(url: url, timeoutInterval: 45)
        request.httpMethod = method
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let prefer { request.setValue(prefer, forHTTPHeaderField: "Prefer") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let retryKey = "\(method) \(url.host ?? "")\(url.path)"
        let queuedAt = ProcessInfo.processInfo.systemUptime
        let observed = try await backgroundRetries.wait(retryKey)
        PerformanceDiagnostics.shared.record(.cloud, .queueMs, max(0, ProcessInfo.processInfo.systemUptime - queuedAt) * 1_000)
        if observed != nil { PerformanceDiagnostics.shared.record(.cloud, .retries) }
        let (data, response): (Data, URLResponse)
        do {
            PerformanceDiagnostics.shared.record(.cloud, .requests)
            PerformanceDiagnostics.shared.record(.cloud, .requestBytes, Double(request.httpBody?.count ?? 0))
            (data, response) = try await URLSession(configuration: .ephemeral).data(for: request)
        } catch {
            if !Task.isCancelled, let error = error as? URLError, error.code != .cancelled { await backgroundRetries.failed(retryKey) }
            throw error
        }
        PerformanceDiagnostics.shared.record(.cloud, .responseBytesRead, Double(data.count))
        guard let http = response as? HTTPURLResponse else { throw NativeError(message: "Supabase returned no HTTP response.") }
        guard (200..<300).contains(http.statusCode) else {
            let errorObject = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let message = errorObject?["message"] as? String ?? errorObject?["error_description"] as? String ?? "Cloud sync returned HTTP \(http.statusCode)."
            let retryable = [408, 409, 429].contains(http.statusCode) || http.statusCode >= 500
            if retryable { await backgroundRetries.failed(retryKey, retryAfter: http.value(forHTTPHeaderField: "Retry-After")) }
            else { await backgroundRetries.succeeded(retryKey, observed: observed) }
            throw NativeError(message: message, retryable: retryable)
        }
        await backgroundRetries.succeeded(retryKey, observed: observed)
        if data.isEmpty { return NSNull() }
        return try JSONSerialization.jsonObject(with: data)
    }

    private func cloudMemoryPage(after: String?, supabaseURL: URL, anonKey: String, session: CloudSession) async throws -> Any {
        var components = URLComponents(url: supabaseURL.appendingPathComponent("rest/v1/fact_memory"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "fact_id,content,known,fingerprint"),
            URLQueryItem(name: "user_id", value: "eq.\(session.userID)"),
            URLQueryItem(name: "order", value: "fact_id.asc"),
            URLQueryItem(name: "limit", value: "500")
        ]
        if let after { components.queryItems?.append(URLQueryItem(name: "fact_id", value: "gt.\(after)")) }
        return try await cloudRequest(components.url!, method: "GET", anonKey: anonKey, session: session)
    }

    private func cloudLoad() async throws -> [String: Any] {
        let (supabaseURL, anonKey) = try cloudConfiguration()
        let session = try await cloudSession()
        let revisionsURL = supabaseURL.appendingPathComponent("rest/v1/rpc/latest_workspace_revisions")
        async let revisions = cloudRequest(revisionsURL, method: "POST", anonKey: anonKey, session: session, body: [:])
        async let firstPage = cloudMemoryPage(after: nil, supabaseURL: supabaseURL, anonKey: anonKey, session: session)
        let (revisionResult, firstMemoryPage) = try await (revisions, firstPage)
        var records: [[String: Any]] = []
        for row in revisionResult as? [Any] ?? [NSNull()] {
            let record = (row as? [String: Any])?["record"]
            guard SnapshotValidation.validate(record, kind: .record, operation: .import), let record = record as? [String: Any] else {
                throw NativeError(message: "Cloud workspace data failed validation. Local recovery copies were kept.", retryable: false)
            }
            records.append(record)
        }
        var memories: [[String: Any]] = []
        var after: String? = nil
        while true {
            let result = after == nil ? firstMemoryPage : try await cloudMemoryPage(after: after, supabaseURL: supabaseURL, anonKey: anonKey, session: session)
            guard let rows = result as? [[String: Any]] else {
                _ = SnapshotValidation.validate(nil, kind: .memory, operation: .import)
                throw NativeError(message: "Cloud fact data failed validation. Local recovery copies were kept.", retryable: false)
            }
            for row in rows {
                guard SnapshotValidation.validate([row["content"] ?? NSNull()], kind: .memory, operation: .import), var content = row["content"] as? [String: Any] else {
                    throw NativeError(message: "Cloud fact data failed validation. Local recovery copies were kept.", retryable: false)
                }
                if let fingerprint = row["fingerprint"] as? String { content["fingerprint"] = fingerprint }
                if let known = row["known"] as? Bool { content["known"] = known }
                memories.append(content)
            }
            if rows.count < 500 { break }
            // Match the database's exclusive ordering; content.id can change on merge.
            guard let next = rows.last?["fact_id"] as? String, next != after else {
                throw NativeError(message: "Cloud fact history returned an invalid cursor.")
            }
            after = next
        }
        guard SnapshotValidation.validate(memories, kind: .memory, operation: .import) else {
            throw NativeError(message: "Cloud fact data failed validation. Local recovery copies were kept.", retryable: false)
        }
        return ["records": records, "factMemory": memories]
    }

    private let cloudSecretKeys: Set<String> = ["key", "apiKey", "youtubeKey", "geminiKey", "access_token", "refresh_token", "provider_token", "provider_refresh_token"]

    private func cleanedCloudValue(_ value: Any) -> Any {
        if let array = value as? [Any] { return array.map(cleanedCloudValue) }
        if let object = value as? [String: Any] {
            return object.reduce(into: [String: Any]()) { result, pair in
                guard !cloudSecretKeys.contains(pair.key) else { return }
                result[pair.key] = cleanedCloudValue(pair.value)
            }
        }
        return value
    }

    private func canonicalCloudRecord(_ raw: [String: Any]) -> [String: Any] {
        let source = raw["state"] as? [String: Any] ?? [:]
        let activitySource = source["youtubeActivity"] as? [String: Any] ?? [:]
        let activityKeys = ["prioritizeRecentByChannel", "smartRan", "savedIds", "history", "playbackPositions", "searchText", "selectedTopic", "activeTab", "selectedChannelId", "selectedVideoId", "discoverIds", "channelOrder", "smartIds", "smartReasons", "topic", "tab", "order"]
        let activity = WorkspaceActivity.canonicalized(activityKeys.reduce(into: [String: Any]()) { result, key in if let value = activitySource[key] { result[key] = cleanedCloudValue(value) } })
        let state: [String: Any] = [
            "persistenceVersion": source["persistenceVersion"] ?? 2,
            "topicCatalogVersion": source["topicCatalogVersion"] ?? source["catalogVersion"] ?? 0,
            "savedAt": source["savedAt"] ?? NSNull(),
            "topics": cleanedCloudValue(source["topics"] ?? []),
            "settings": cleanedCloudValue(source["settings"] ?? [:]),
            "cards": cleanedCloudValue(source["cards"] ?? []),
            "learningProfile": cleanedCloudValue(source["learningProfile"] ?? source["profile"] ?? [:]),
            "feedStarted": source["feedStarted"] ?? source["started"] ?? false,
            "theme": source["theme"] ?? "light",
            "lastCompletedBatchSetup": cleanedCloudValue(source["lastCompletedBatchSetup"] ?? NSNull()),
            "youtubeActivity": activity
        ]
        return ["id": raw["id"] ?? "", "name": raw["name"] ?? "Local Workspace", "createdAt": raw["createdAt"] ?? cloudNow(), "updatedAt": raw["updatedAt"] ?? cloudNow(), "state": state]
    }

    private func workspaceRevisionID(userID: String, record: [String: Any]) throws -> String {
        // Account and complete snapshot determine identity, including after app restart.
        let input = try JSONSerialization.data(withJSONObject: ["workspace-revision-v1", userID.lowercased(), record], options: [.sortedKeys, .withoutEscapingSlashes])
        var bytes = Array(SHA256.hash(data: input).prefix(16))
        bytes[6] = (bytes[6] & 0x0f) | 0x80
        bytes[8] = (bytes[8] & 0x3f) | 0x80
        let hex = bytes.map { String(format: "%02x", $0) }.joined()
        let segments = [0..<8, 8..<12, 12..<16, 16..<20, 20..<32]
        return segments.map { range in String(hex.dropFirst(range.lowerBound).prefix(range.count)) }.joined(separator: "-")
    }

    private func cloudSave(_ value: Any?) async throws -> [String: Any] {
        let (supabaseURL, anonKey) = try cloudConfiguration()
        let session = try await cloudSession()
        let envelope = value as? [String: Any] ?? [:]
        guard envelope["cloudOwnerId"] as? String == session.userID else {
            throw NativeError(message: "Account changed. Cloud save was canceled.", retryable: false)
        }
        try Task.checkCancellation()
        guard SnapshotValidation.validate(envelope, kind: .nativeStore, operation: .save) else {
            throw NativeError(message: "Workspace data failed validation. Cloud copies were kept.", retryable: false)
        }
        let rawWorkspaces = envelope["workspaces"] as? [[String: Any]] ?? []
        // Bound uploads by row count and encoded bytes; never split a workspace.
        var batches: [[[String: Any]]] = []
        var batch: [[String: Any]] = []
        var batchBytes = 2
        for raw in rawWorkspaces {
            guard SnapshotValidation.validate(raw, kind: .record, operation: .save) else {
                throw NativeError(message: "Workspace data failed validation. Cloud copies were kept.", retryable: false)
            }
            let record = canonicalCloudRecord(raw)
            let row: [String: Any] = ["revision_id": try workspaceRevisionID(userID: session.userID, record: record), "user_id": session.userID, "workspace_id": record["id"] ?? "", "modified_at": record["updatedAt"] ?? cloudNow(), "record": record]
            let rowBytes = try JSONSerialization.data(withJSONObject: row).count
            if !batch.isEmpty && (batch.count >= 20 || batchBytes + rowBytes + 1 > 1024 * 1024) {
                batches.append(batch)
                batch = []
                batchBytes = 2
            }
            batchBytes += rowBytes + (batch.isEmpty ? 0 : 1)
            batch.append(row)
        }
        if !batch.isEmpty { batches.append(batch) }
        var revisionsURL = URLComponents(url: supabaseURL.appendingPathComponent("rest/v1/workspace_revisions"), resolvingAgainstBaseURL: false)!
        revisionsURL.queryItems = [URLQueryItem(name: "on_conflict", value: "revision_id")]
        for rows in batches {
            _ = try await cloudRequest(revisionsURL.url!, method: "POST", anonKey: anonKey, session: session, body: rows, prefer: "resolution=ignore-duplicates,return=minimal")
        }
        let memories = (envelope["factMemory"] as? [[String: Any]] ?? []).map { cleanedCloudValue($0) }
        for start in stride(from: 0, to: memories.count, by: 100) {
            let batch = Array(memories[start..<min(start + 100, memories.count)])
            _ = try await cloudRequest(supabaseURL.appendingPathComponent("rest/v1/rpc/remember_facts"), method: "POST", anonKey: anonKey, session: session, body: ["items": batch])
        }
        return ["savedWorkspaces": rawWorkspaces.count, "savedFacts": memories.count]
    }

    private func youtubeRequest(resource: String, key: String, params: [String: Any]) async throws -> Any {
        let allowedResources: Set<String> = ["channels", "search", "playlistItems", "videos"]
        guard allowedResources.contains(resource) else { throw NativeError(message: "That YouTube request is outside the approved catalog service.", retryable: false) }
        guard !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw NativeError(message: "Paste your YouTube API key in Settings before connecting.", retryable: false) }
        var components = URLComponents(string: "https://www.googleapis.com/youtube/v3/\(resource)")!
        components.queryItems = params.compactMap { name, value in
            guard let string = value as? String else { return nil }
            return URLQueryItem(name: name, value: string)
        }.sorted { $0.name < $1.name }
        guard let url = components.url else { throw NativeError(message: "The YouTube request could not be formed.", retryable: false) }
        var request = URLRequest(url: url, timeoutInterval: 30)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(key, forHTTPHeaderField: "x-goog-api-key")
        let conditional = await youtubeDownloads.prepare(request, credential: key)
        let retryKey = "youtube/\(resource)"
        let queuedAt = ProcessInfo.processInfo.systemUptime
        let observed = try await backgroundRetries.wait(retryKey)
        await youtubeLimiter.acquire()
        let (data, response): (Data, URLResponse)
        do {
            try Task.checkCancellation()
            PerformanceDiagnostics.shared.record(.youtube, .queueMs, max(0, ProcessInfo.processInfo.systemUptime - queuedAt) * 1_000)
            if observed != nil { PerformanceDiagnostics.shared.record(.youtube, .retries) }
            PerformanceDiagnostics.shared.record(.youtube, .requests)
            (data, response) = try await youtubeSession.data(for: conditional.request)
            await youtubeLimiter.release()
        } catch is CancellationError {
            await youtubeLimiter.release()
            throw NativeError(message: "YouTube request canceled.", retryable: false)
        } catch {
            await youtubeLimiter.release()
            if Task.isCancelled || (error as? URLError)?.code == .cancelled { throw CancellationError() }
            if error is URLError { await backgroundRetries.failed(retryKey) }
            throw NativeError(message: "YouTube could not be reached right now.")
        }
        PerformanceDiagnostics.shared.record(.youtube, .responseBytesRead, Double(data.count))
        try Task.checkCancellation()
        guard let http = response as? HTTPURLResponse else { throw NativeError(message: "YouTube returned no HTTP response.") }
        let reused = await youtubeDownloads.notModified(conditional, response: http)
        if http.statusCode == 304, reused == nil { throw NativeError(message: "YouTube returned Not Modified without a validated response.", retryable: true) }
        let body = reused ?? data
        let object = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any] ?? [:]
        guard (200..<300).contains(http.statusCode) || reused != nil else {
            let errorObject = object["error"] as? [String: Any]
            let message = errorObject?["message"] as? String ?? "YouTube returned HTTP \(http.statusCode)."
            let reason = (errorObject?["errors"] as? [[String: Any]])?.first?["reason"] as? String
            if reason == "quotaExceeded" || reason == "dailyLimitExceeded" { throw NativeError(message: "YouTube API quota is exhausted. Resume after the quota resets.", retryable: false) }
            if reason == "invalidPageToken" { throw NativeError(message: "YouTube returned an invalid page token. Retry to restart this source.", retryable: false) }
            let retryable = [408, 429].contains(http.statusCode) || http.statusCode >= 500 || reason == "rateLimitExceeded" || reason == "userRateLimitExceeded"
            if retryable { await backgroundRetries.failed(retryKey, retryAfter: http.value(forHTTPHeaderField: "Retry-After")) }
            else { await backgroundRetries.succeeded(retryKey, observed: observed) }
            throw NativeError(message: message, retryable: retryable)
        }
        if reused != nil { PerformanceDiagnostics.shared.record(.youtube, .cacheHits) }
        else if http.statusCode == 200, object["error"] == nil, object["items"] is [[String: Any]], object["nextPageToken"] == nil || object["nextPageToken"] is String {
            try Task.checkCancellation()
            await youtubeDownloads.validated(conditional, response: http, body: body, bodyETag: object["etag"] as? String)
        } else { await youtubeDownloads.discard(conditional) }
        await backgroundRetries.succeeded(retryKey, observed: observed)
        return object
    }

    private func userMessage(_ error: Error) -> String {
        if let error = error as? NativeError { return error.message }
        return "The request could not be completed. Check your key and try again."
    }

    private func respondGeminiFailure(id: String, error: Error) {
        if let failure = error as? NativeError, !failure.outcomes.isEmpty || failure.status != nil {
            var event: [String: Any] = ["type": "operationStatus", "modelOutcomes": failure.outcomes, "validationDiagnostics": failure.validationDiagnostics]
            if let status = failure.status { event["status"] = status }
            respondEvent(id: id, payload: event)
        }
        respond(id: id, error: userMessage(error))
    }

    private func factPDF(text: String, facts: [[String: Any]], images: [String: Data]) async throws -> Data {
        let output = NSMutableData()
        var box = CGRect(x: 0, y: 0, width: 612, height: 792)
        guard let consumer = CGDataConsumer(data: output as CFMutableData), let context = CGContext(consumer: consumer, mediaBox: &box, nil) else { throw CocoaError(.fileWriteUnknown) }
        var y: CGFloat = 742, page = 0
        func newPage() {
            if page > 0 { context.endPDFPage() }
            context.beginPDFPage(nil); page += 1; y = 742
            context.textPosition = CGPoint(x: 50, y: 24)
            CTLineDraw(CTLineCreateWithAttributedString(NSAttributedString(string: String(page), attributes: [.font: NSFont.systemFont(ofSize: 9), .foregroundColor: NSColor.gray])), context)
        }
        func draw(_ value: String, size: CGFloat = 11, bold: Bool = false, link: String? = nil) async throws {
            let attributes: [NSAttributedString.Key: Any] = [.font: bold ? NSFont.boldSystemFont(ofSize: size) : NSFont.systemFont(ofSize: size), .foregroundColor: NSColor.black]
            let attributed = NSAttributedString(string: value.isEmpty ? " " : value, attributes: attributes)
            let typesetter = CTTypesetterCreateWithAttributedString(attributed)
            var offset = 0, lines = 0
            while offset < attributed.length {
                try Task.checkCancellation()
                if y < 65 + size * 1.5 { newPage() }
                let count = CTTypesetterSuggestLineBreak(typesetter, offset, 512)
                guard count > 0 else { throw CocoaError(.fileWriteUnknown) }
                let line = CTTypesetterCreateLine(typesetter, CFRange(location: offset, length: count))
                context.textPosition = CGPoint(x: 50, y: y); CTLineDraw(line, context)
                if let raw = link, let url = URL(string: raw) { context.setURL(url as CFURL, for: CGRect(x: 50, y: y-size, width: 512, height: size*1.5)) }
                y -= size * 1.5; offset += count
                lines += 1
                if lines % 32 == 0 { await Task.yield() }
            }
            y -= 6
        }
        newPage()
        let header = text.components(separatedBy: String(repeating: "=", count: 72))[0]
        try await draw(header)
        for (index, fact) in facts.enumerated() {
            await Task.yield()
            try Task.checkCancellation()
            let title = "\(index + 1). \(fact["title"] as? String ?? "Fact")", hook = fact["hook"] as? String ?? ""
            let titleHeight = (title as NSString).boundingRect(with: NSSize(width: 512, height: CGFloat.greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], attributes: [.font: NSFont.boldSystemFont(ofSize: 16)]).height
            let hookHeight = (hook as NSString).boundingRect(with: NSSize(width: 512, height: CGFloat.greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], attributes: [.font: NSFont.boldSystemFont(ofSize: 12)]).height
            let hasImage = (fact["image"] as? [String: Any])?["url"] as? String
            let pictureHeight: CGFloat = hasImage.flatMap { images[$0] } != nil ? 300 : 0
            let requiredHeight: CGFloat = min(680, titleHeight + hookHeight + pictureHeight + 100)
            if y < requiredHeight { newPage() }
            try await draw("\(index + 1). \(fact["title"] as? String ?? "Fact")", size: 16, bold: true)
            try await draw(fact["hook"] as? String ?? "", size: 12, bold: true)
            if let image = fact["image"] as? [String: Any], let url = image["url"] as? String {
                if let bytes = images[url], let source = CGImageSourceCreateWithData(bytes as CFData, nil), let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 1200, kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary) {
                    let scale = min(512 / CGFloat(cgImage.width), 280 / CGFloat(cgImage.height)), width = CGFloat(cgImage.width) * scale, height = CGFloat(cgImage.height) * scale
                    if y - height < 60 { newPage() }
                    context.draw(cgImage, in: CGRect(x: 50, y: y-height, width: width, height: height)); y -= height + 12
                } else { try await draw("Image unavailable in this download.", size: 9) }
            }
            try await draw(fact["body"] as? String ?? "")
            try await draw("Topic path: \((fact["topicPath"] as? [String] ?? []).joined(separator: " / "))", size: 9)
            for source in fact["sources"] as? [[String: Any]] ?? [] {
                let url = source["url"] as? String ?? ""
                try await draw(source["title"] as? String ?? "Wikipedia", size: 10, bold: true, link: url); try await draw(url, size: 9, link: url)
            }
            if let image = fact["image"] as? [String: Any] {
                if let credit = image["credit"] as? String { try await draw("Image credit: \(credit)", size: 9) }
                if let url = image["filePageUrl"] as? String ?? image["sourceUrl"] as? String { try await draw(url, size: 9, link: url) }
            }
            y -= 14
        }
        context.endPDFPage(); context.closePDF()
        return output as Data
    }

    private func exportFacts(id: String, payload: [String: Any]) {
        let format = payload["format"] as? String ?? "txt", folder = payload["folder"] as? Bool ?? false, files = payload["files"] as? [[String: Any]] ?? [], token = payload["token"] as? Int ?? 0
        guard !files.isEmpty, files.count <= 65535 else { respond(id: id, error: "There are no cards to download."); return }
        activeTasks[id] = Task { [weak self] in
            guard let self else { return }
            defer { activeTasks[id] = nil }
            do {
                var images: [String: Data] = [:], omitted = 0
                if format == "pdf" {
                    let urls = Array(Set(files.flatMap { $0["facts"] as? [[String: Any]] ?? [] }.compactMap { ($0["image"] as? [String: Any])?["url"] as? String }))
                    for start in stride(from: 0, to: urls.count, by: 3) {
                        try Task.checkCancellation()
                        let batch = Array(urls[start..<min(start + 3, urls.count)])
                        let downloaded = await withTaskGroup(of: (String, Data?).self) { group in
                            for raw in batch { group.addTask {
                                guard let url = URL(string: raw), ["https", "http"].contains(url.scheme ?? "") else { return (raw, nil) }
                                var request = URLRequest(url: url); request.timeoutInterval = 12
                                do { let (data, response) = try await URLSession.shared.data(for: request); guard (response as? HTTPURLResponse)?.statusCode == 200, data.count <= 30 * 1024 * 1024, CGImageSourceCreateWithData(data as CFData, nil) != nil else { return (raw, nil) }; guard let source = CGImageSourceCreateWithData(data as CFData, nil), let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 1200, kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary) else { return (raw, nil) }
                                let compressed = NSMutableData()
                                guard let destination = CGImageDestinationCreateWithData(compressed, UTType.jpeg.identifier as CFString, 1, nil) else { return (raw, nil) }
                                CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.8] as CFDictionary)
                                guard CGImageDestinationFinalize(destination) else { return (raw, nil) }
                                return (raw, compressed as Data) } catch { return (raw, nil) }
                            } }
                            var results: [(String, Data?)] = []; for await result in group { results.append(result) }; return results
                        }
                        try Task.checkCancellation()
                        for (url, data) in downloaded { if let data { images[url] = data } }
                        try Task.checkCancellation()
                        respondEvent(id: id, payload: ["type": "exportProgress", "token": token, "message": "Preparing pictures · \(min(start + 3, urls.count)) of \(urls.count)"])
                    }
                    omitted = files.flatMap { $0["facts"] as? [[String: Any]] ?? [] }.filter { fact in guard let url = (fact["image"] as? [String: Any])?["url"] as? String else { return false }; return images[url] == nil }.count
                }
                var entries: [(name: String, data: Data)] = []
                var archiveSize = FactDownloadArchive.SizeTracker()
                for (index, file) in files.enumerated() {
                    try Task.checkCancellation()
                    let text = file["text"] as? String ?? "", facts = file["facts"] as? [[String: Any]] ?? []
                    let data = format == "pdf" ? try await factPDF(text: text, facts: facts, images: images) : Data(text.utf8)
                    let filename = file["name"] as? String ?? "Fact.\(format)"
                    entries.append((filename, data))
                    if folder {
                        try archiveSize.append(name: filename, byteCount: data.count)
                    }
                    respondEvent(id: id, payload: ["type": "exportProgress", "token": token, "message": "Preparing files · \(index + 1) of \(files.count)"])
                    await Task.yield()
                }
                try Task.checkCancellation()
                let data: Data
                if folder {
                    data = try await FactDownloadArchive.build(entries) { [weak self] phase, processed, total in
                        let percent = total == 0 ? 100 : min(100, processed * 100 / total)
                        self?.respondEvent(id: id, payload: ["type": "exportProgress", "token": token, "message": "\(phase) · \(percent)%"])
                    }
                } else {
                    data = entries[0].data
                }
                try Task.checkCancellation()
                let requestedFilename = payload["filename"] as? String ?? "Facts.\(format)"
                let panel = NSSavePanel(); panel.nameFieldStringValue = requestedFilename; panel.allowedContentTypes = [folder ? .zip : format == "pdf" ? .pdf : .plainText]; panel.canCreateDirectories = true
                let waiter = SavePanelWaiter()
                let response = await withTaskCancellationHandler(operation: {
                    await withCheckedContinuation { continuation in
                        guard waiter.install(continuation) else { continuation.resume(returning: .cancel); return }
                        DispatchQueue.main.async {
                            guard waiter.begin() else { return }
                            panel.begin { waiter.finish($0) }
                        }
                    }
                }, onCancel: {
                    if waiter.cancel() { DispatchQueue.main.async { panel.cancel(nil) } }
                })
                try Task.checkCancellation()
                guard response == .OK, let url = panel.url else { respond(id: id, result: ["canceled": true]); return }
                try Task.checkCancellation()
                try data.write(to: url, options: .atomic)
                respond(id: id, result: ["canceled": false, "format": format, "omittedImages": omitted, "filename": url.lastPathComponent, "cardCount": files.reduce(0) { $0 + (($1["facts"] as? [[String: Any]])?.count ?? 0) }])
            } catch is CancellationError { respond(id: id, error: "Download canceled.") }
            catch { respond(id: id, error: "Download could not be saved: \(error.localizedDescription)") }
        }
    }

    private func cancelActiveTasks(preserveCloudSync: Bool = false) {
        let tasks = activeTasks.filter { !preserveCloudSync || !cloudSyncTasks.contains($0.key) }
        tasks.forEach { taskID, task in
            activeTasks[taskID] = nil
            cloudSyncTasks.remove(taskID)
            task.cancel()
            respond(id: taskID, error: "Request canceled.")
        }
    }

    private func loadState() -> Any {
        youtubePlaybackCheckpoints.mergingIntoSnapshot(workspace.load())
    }

    private func saveState(_ value: Any?) throws {
        guard let value else { return try workspace.save(value) }
        try workspace.save(youtubePlaybackCheckpoints.mergingIntoSnapshot(value))
    }

    private func signIn(id: String) {
        guard let rawURL = config["SupabaseURL"] as? String,
              let supabaseURL = URL(string: rawURL),
              let anonKey = config["SupabasePublishableKey"] as? String,
              !anonKey.isEmpty else {
            respond(id: id, error: "Google sign-in is not configured yet. Enable Google in the Learned Media Supabase Auth providers.")
            return
        }
        authRequestID = id
        authVerifier = randomString(length: 64)
        authState = randomString(length: 32)
        let digest = SHA256.hash(data: Data(authVerifier.utf8))
        var components = URLComponents(url: supabaseURL.appendingPathComponent("auth/v1/authorize"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: "learnedmedia://auth/callback"),
            URLQueryItem(name: "code_challenge", value: base64URL(Data(digest))),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: authState)
        ]
        guard let url = components.url else {
            respond(id: id, error: "Google sign-in could not create its secure callback.")
            return
        }
        authSession = ASWebAuthenticationSession(url: url, callbackURLScheme: "learnedmedia") { [weak self] callback, error in
            guard let self else { return }
            if let error {
                self.respond(id: id, error: error.localizedDescription)
                return
            }
            guard let callback, let callbackComponents = URLComponents(url: callback, resolvingAgainstBaseURL: false),
                  callbackComponents.queryItems?.first(where: { $0.name == "state" })?.value == self.authState,
                  let code = callbackComponents.queryItems?.first(where: { $0.name == "code" })?.value else {
                self.respond(id: id, error: "Google sign-in returned an invalid callback.")
                return
            }
            Task {
                do {
                    let session = try await self.exchangeCode(code, verifier: self.authVerifier, supabaseURL: supabaseURL, anonKey: anonKey)
                    self.sessionEpoch += 1
                    self.sessionRefresh?.cancel()
                    self.sessionRefresh = nil
                    try self.keychain.saveSession(session.sessionData)
                    self.respond(id: id, result: ["account": session.account])
                } catch {
                    self.respond(id: id, error: self.userMessage(error))
                }
                self.authSession = nil
            }
        }
        authSession?.presentationContextProvider = self
        authSession?.prefersEphemeralWebBrowserSession = false
        if authSession?.start() != true {
            respond(id: id, error: "Google sign-in could not open the system browser.")
        }
    }

    private func exchangeCode(_ code: String, verifier: String, supabaseURL: URL, anonKey: String) async throws -> (sessionData: Data, account: [String: Any]) {
        var components = URLComponents(url: supabaseURL.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "pkce")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["auth_code": code, "code_verifier": verifier])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NativeError(message: "Google sign-in was not accepted. Enable the Google provider and add the Learned Media callback URL.")
        }
        let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        guard let accessToken = payload["access_token"] as? String, !accessToken.isEmpty else {
            throw NativeError(message: "Google sign-in did not return a session.")
        }
        var userRequest = URLRequest(url: supabaseURL.appendingPathComponent("auth/v1/user"))
        userRequest.setValue(anonKey, forHTTPHeaderField: "apikey")
        userRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        let (userData, _) = try await URLSession.shared.data(for: userRequest)
        let user = try JSONSerialization.jsonObject(with: userData) as? [String: Any] ?? [:]
        let metadata = user["user_metadata"] as? [String: Any] ?? [:]
        let account: [String: Any] = [
            "id": user["id"] as? String ?? "",
            "name": metadata["full_name"] as? String ?? metadata["name"] as? String ?? user["email"] as? String ?? "Google learner",
            "email": user["email"] as? String ?? ""
        ]
        return (try normalizedSessionData(data), account)
    }

    private func normalizedSessionData(_ data: Data) throws -> Data {
        var object = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        if object["expires_at"] == nil, let duration = object["expires_in"] as? NSNumber {
            object["expires_at"] = Date().timeIntervalSince1970 + duration.doubleValue
        }
        return try JSONSerialization.data(withJSONObject: object)
    }

    private func randomString(length: Int) -> String {
        let alphabet = Array("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
        return String((0..<length).compactMap { _ in alphabet.randomElement() })
    }

    private func base64URL(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    private func respond(id: String, result: Any) {
        DispatchQueue.main.async {
            guard let data = try? JSONSerialization.data(withJSONObject: ["id": id, "ok": true, "result": result]), let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.__nativeResolve(\(json));")
        }
    }

    private func respond(id: String, error: String) {
        DispatchQueue.main.async {
            guard let data = try? JSONSerialization.data(withJSONObject: ["id": id, "ok": false, "error": error]), let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.__nativeResolve(\(json));")
        }
    }

    private func respondEvent(id: String, payload: [String: Any]) {
        var scopedPayload = payload
        scopedPayload["requestId"] = id
        DispatchQueue.main.async {
            guard let data = try? JSONSerialization.data(withJSONObject: scopedPayload), let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.__nativeEvent(\(json));")
        }
    }
}

let application = NSApplication.shared
private let delegate = AppDelegate()
application.delegate = delegate
application.run()
