// Renders AppIcon.icns: a warm gradient squircle with a white bolt.
// Run via app/macos/icon/make-icon.sh, which also builds the .icns.
import AppKit

let size: CGFloat = 1024
let out = CommandLine.arguments.dropFirst().first ?? "icon_1024.png"

let image = NSImage(size: NSSize(width: size, height: size), flipped: false) { _ in
    // macOS icon grid: 824pt body centered on a 1024 canvas, ~185pt corner radius.
    let body = NSRect(x: 100, y: 100, width: 824, height: 824)
    let path = NSBezierPath(roundedRect: body, xRadius: 185, yRadius: 185)

    NSGraphicsContext.current?.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.25)
    shadow.shadowOffset = NSSize(width: 0, height: -12)
    shadow.shadowBlurRadius = 28
    shadow.set()
    NSColor.black.setFill()
    path.fill()
    NSGraphicsContext.current?.restoreGraphicsState()

    let gradient = NSGradient(colors: [
        NSColor(red: 1.00, green: 0.62, blue: 0.10, alpha: 1),
        NSColor(red: 0.98, green: 0.26, blue: 0.36, alpha: 1),
        NSColor(red: 0.55, green: 0.20, blue: 0.95, alpha: 1),
    ])!
    gradient.draw(in: path, angle: -60)

    let config = NSImage.SymbolConfiguration(pointSize: 520, weight: .heavy)
        .applying(.init(paletteColors: [.white]))
    if let bolt = NSImage(systemSymbolName: "bolt.fill", accessibilityDescription: nil)?
        .withSymbolConfiguration(config) {
        let b = bolt.size
        bolt.draw(in: NSRect(x: (size - b.width) / 2, y: (size - b.height) / 2, width: b.width, height: b.height))
    }
    return true
}

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size), pixelsHigh: Int(size), bitsPerSample: 8,
                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                           bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
image.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
