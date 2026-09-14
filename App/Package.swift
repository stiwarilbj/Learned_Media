// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LearnedMediaApp",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "LearnedMediaApp", targets: ["LearnedMediaApp"])
    ],
    targets: [
        .executableTarget(name: "LearnedMediaApp", path: "Sources/LearnedMediaApp")
    ]
)
