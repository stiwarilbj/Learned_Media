// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LearnedMediaApp",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "LearnedMediaCore", targets: ["LearnedMediaCore"]),
        .executable(name: "LearnedMediaApp", targets: ["LearnedMediaApp"])
    ],
    targets: [
        .target(name: "LearnedMediaCore", path: "Sources/LearnedMediaCore"),
        .executableTarget(name: "LearnedMediaApp", dependencies: ["LearnedMediaCore"], path: "Sources/LearnedMediaApp"),
        .testTarget(name: "LearnedMediaCoreTests", dependencies: ["LearnedMediaCore"], path: "Tests/LearnedMediaCoreTests")
    ]
)
