import Foundation

/// Store-only ZIP, matching the browser exporter. Names are UTF-8 and include the enclosing folder.
public enum FactDownloadArchive {
    public static func build(_ files: [(name: String, data: Data)]) throws -> Data {
        let limit = 512 * 1024 * 1024
        guard files.count <= 65535, files.reduce(22, { $0 + $1.data.count + $1.name.utf8.count * 2 + 76 }) <= limit else { throw ArchiveError.tooLarge }
        var output = Data(), directory = Data()
        func word(_ value: Int, _ count: Int) -> Data { Data((0..<count).map { UInt8(truncatingIfNeeded: value >> ($0 * 8)) }) }
        for file in files {
            let name = Data(file.name.utf8)
            guard name.count <= 65535, !file.name.hasPrefix("/"), !file.name.split(separator: "/").contains("..") else { throw ArchiveError.invalidName }
            var crc: UInt32 = 0xffffffff
            for byte in file.data { crc ^= UInt32(byte); for _ in 0..<8 { crc = (crc >> 1) ^ (crc & 1 == 1 ? 0xedb88320 : 0) } }
            let checksum = Int(crc ^ 0xffffffff), offset = output.count
            var header = Data([0x50, 0x4b, 3, 4]); header += word(20,2); header += word(0x800,2); header += word(0,6); header += word(checksum,4); header += word(file.data.count,4); header += word(file.data.count,4); header += word(name.count,2); header += word(0,2); header += name
            output += header; output += file.data
            directory += Data([0x50,0x4b,1,2]); directory += word(20,2); directory += word(20,2); directory += word(0x800,2); directory += word(0,6); directory += word(checksum,4); directory += word(file.data.count,4); directory += word(file.data.count,4); directory += word(name.count,2); directory += word(0,12); directory += word(offset,4); directory += name
        }
        let start = output.count
        output += directory; output += Data([0x50,0x4b,5,6]); output += word(0,4); output += word(files.count,2); output += word(files.count,2); output += word(directory.count,4); output += word(start,4); output += word(0,2)
        return output
    }
    public enum ArchiveError: LocalizedError {
        case tooLarge, invalidName
        public var errorDescription: String? { self == .tooLarge ? "Archive exceeds the 512 MB download limit. Download a smaller collection." : "Invalid download filename." }
    }
}
