// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Tokenmaxxing",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(name: "Tokenmaxxing", path: "Sources/Tokenmaxxing"),
        .testTarget(
            name: "TokenmaxxingTests",
            dependencies: ["Tokenmaxxing"],
            path: "Tests/TokenmaxxingTests",
            resources: [.copy("Fixtures")]
        ),
    ],
    swiftLanguageModes: [.v6]
)
