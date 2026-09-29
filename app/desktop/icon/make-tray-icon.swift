// Renders the menu bar icon: the bolt as a black-on-clear template image, so macOS tints it for
// light and dark menu bars. Run via make-icons.sh.
import AppKit

let px: CGFloat = 44 // 22 pt at 2x
let out = CommandLine.arguments.dropFirst().first ?? "tray.png"
let config = NSImage.SymbolConfiguration(pointSize: 30, weight: .semibold)
let bolt = NSImage(systemSymbolName: "bolt.fill", accessibilityDescription: nil)!.withSymbolConfiguration(config)!

let image = NSImage(size: NSSize(width: px, height: px), flipped: false) { rect in
    let s = bolt.size
    bolt.draw(in: NSRect(x: (rect.width - s.width) / 2, y: (rect.height - s.height) / 2, width: s.width, height: s.height))
    return true
}
let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
