import Foundation

/// Store-only ZIP, matching the browser exporter. Names are UTF-8 and include the enclosing folder.
public enum FactDownloadArchive {
    private static let archiveLimit = 512 * 1024 * 1024
    private static let copyChunkSize = 1024 * 1024
    private static let crcTable: [UInt32] = (0..<256).map { value in
        var crc = UInt32(value)
        for _ in 0..<8 { crc = (crc >> 1) ^ (crc & 1 == 1 ? 0xedb88320 : 0) }
        return crc
    }

    private struct PreparedFile {
        let name: Data
        let data: Data
        let checksum: UInt32
        let offset: Int
    }

    public struct SizeTracker {
        private var count = 0
        private var total = 22

        public init() {}

        public mutating func append(name: String, byteCount: Int) throws {
            guard count < 65535 else { throw ArchiveError.tooLarge }
            let nameLength = name.utf8.count
            guard validName(name), nameLength <= 65535 else { throw ArchiveError.invalidName }
            guard byteCount >= 0, byteCount <= Int(UInt32.max) else { throw ArchiveError.tooLarge }
            let (entrySize, overflow1) = byteCount.addingReportingOverflow(76 + nameLength * 2)
            let (next, overflow2) = total.addingReportingOverflow(entrySize)
            guard !overflow1, !overflow2, next <= archiveLimit, next <= Int(UInt32.max) else {
                throw ArchiveError.tooLarge
            }
            count += 1
            total = next
        }
    }

    public static func build(
        _ files: [(name: String, data: Data)],
        onProgress: ((String, Int, Int) -> Void)? = nil
    ) async throws -> Data {
        try Task.checkCancellation()
        try validateSize(files.map { (name: $0.name, byteCount: $0.data.count) })
        var total = 22
        for file in files {
            let nameLength = file.name.utf8.count
            total += 76 + nameLength * 2 + file.data.count
        }

        var prepared: [PreparedFile] = []
        prepared.reserveCapacity(files.count)
        let payloadBytes = files.reduce(0) { $0 + $1.data.count }
        var checksumProgress = 0, checksumReported = 0
        var localOffset = 0
        for file in files {
            try Task.checkCancellation()
            var checksum: UInt32 = 0xffffffff
            var start = 0
            while start < file.data.count {
                try Task.checkCancellation()
                let end = min(start + copyChunkSize, file.data.count)
                for index in start..<end {
                    checksum = (checksum >> 8) ^ crcTable[Int((checksum ^ UInt32(file.data[index])) & 0xff)]
                }
                let chunkBytes = end - start
                start = end
                checksumProgress += chunkBytes
                if checksumProgress - checksumReported >= 4 * copyChunkSize || checksumProgress == payloadBytes {
                    checksumReported = checksumProgress
                    onProgress?("Checking archive", checksumProgress, payloadBytes)
                }
                if start < file.data.count { await Task.yield() }
            }
            let name = Data(file.name.utf8)
            prepared.append(PreparedFile(name: name, data: file.data, checksum: checksum ^ 0xffffffff, offset: localOffset))
            localOffset += 30 + name.count + file.data.count
        }

        try Task.checkCancellation()
        var output = Data(count: total)
        var cursor = 0
        var copiedBytes = 0, copiedReported = 0
        func write(_ bytes: Data, at offset: Int) {
            let count = bytes.count
            guard count > 0 else { return }
            bytes.withUnsafeBytes { source in
                output.withUnsafeMutableBytes { destination in
                    destination.baseAddress!.advanced(by: offset).copyMemory(from: source.baseAddress!, byteCount: count)
                }
            }
        }
        func word(_ value: UInt64, _ count: Int) -> Data {
            Data((0..<count).map { UInt8(truncatingIfNeeded: value >> ($0 * 8)) })
        }

        for entry in prepared {
            try Task.checkCancellation()
            var header = Data([0x50, 0x4b, 3, 4])
            header += word(20, 2); header += word(0x800, 2); header += word(0, 6)
            header += word(UInt64(entry.checksum), 4)
            header += word(UInt64(entry.data.count), 4); header += word(UInt64(entry.data.count), 4)
            header += word(UInt64(entry.name.count), 2); header += word(0, 2); header += entry.name
            write(header, at: cursor)
            cursor += header.count
            var start = 0
            while start < entry.data.count {
                try Task.checkCancellation()
                let end = min(start + copyChunkSize, entry.data.count)
                write(entry.data.subdata(in: start..<end), at: cursor)
                let chunkBytes = end - start
                cursor += chunkBytes
                start = end
                copiedBytes += chunkBytes
                if copiedBytes - copiedReported >= 4 * copyChunkSize || copiedBytes == payloadBytes {
                    copiedReported = copiedBytes
                    onProgress?("Assembling archive", copiedBytes, payloadBytes)
                }
                if start < entry.data.count { await Task.yield() }
            }
        }

        try Task.checkCancellation()
        let directoryStart = cursor
        var directoryLength = 0
        for entry in prepared {
            try Task.checkCancellation()
            var header = Data([0x50, 0x4b, 1, 2])
            header += word(20, 2); header += word(20, 2); header += word(0x800, 2); header += word(0, 6)
            header += word(UInt64(entry.checksum), 4)
            header += word(UInt64(entry.data.count), 4); header += word(UInt64(entry.data.count), 4)
            header += word(UInt64(entry.name.count), 2); header += word(0, 12)
            header += word(UInt64(entry.offset), 4); header += entry.name
            write(header, at: cursor)
            cursor += header.count
            directoryLength += header.count
            if directoryLength >= copyChunkSize * 4 {
                directoryLength = 0
                await Task.yield()
            }
        }

        try Task.checkCancellation()
        var end = Data([0x50, 0x4b, 5, 6])
        end += word(0, 4); end += word(UInt64(files.count), 2); end += word(UInt64(files.count), 2)
        end += word(UInt64(cursor - directoryStart), 4); end += word(UInt64(directoryStart), 4); end += word(0, 2)
        write(end, at: cursor)
        cursor += end.count
        guard cursor == total else { throw ArchiveError.invalidArchive }
        try Task.checkCancellation()
        onProgress?("Assembling archive", payloadBytes, payloadBytes)
        try Task.checkCancellation()
        return output
    }

    public static func validateSize(_ files: [(name: String, byteCount: Int)]) throws {
        var tracker = SizeTracker()
        for file in files {
            try tracker.append(name: file.name, byteCount: file.byteCount)
        }
    }

    private static func validName(_ name: String) -> Bool {
        !name.isEmpty && !name.hasPrefix("/") && !name.contains("\\") &&
        !name.split(separator: "/", omittingEmptySubsequences: false).contains("..") &&
        !name.split(separator: "/", omittingEmptySubsequences: false).contains("")
    }

    public enum ArchiveError: LocalizedError {
        case tooLarge, invalidName, invalidArchive
        public var errorDescription: String? {
            switch self {
            case .tooLarge: return "Archive exceeds the 512 MB download limit. Download a smaller collection."
            case .invalidName: return "Invalid download filename."
            case .invalidArchive: return "The download archive could not be assembled."
            }
        }
    }
}
