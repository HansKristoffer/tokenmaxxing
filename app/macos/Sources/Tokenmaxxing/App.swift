import SwiftUI

@main
struct TokenmaxxingApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        MenuBarExtra {
            RootView()
                .environment(model)
                .frame(width: 340)
        } label: {
            MenuBarLabel(model: model)
        }
        .menuBarExtraStyle(.window)
    }
}

struct MenuBarLabel: View {
    let model: AppModel

    var body: some View {
        if model.showCountInMenuBar, let me = model.state?.me, model.state?.phase == .ready {
            Label(Format.compact(me.tokens), systemImage: "bolt.fill")
                .labelStyle(.titleAndIcon)
        } else {
            Image(systemName: "bolt.fill")
        }
    }
}

enum Format {
    static func compact(_ n: Double) -> String {
        let abs = Swift.abs(n)
        switch abs {
        case 1e12...: return String(format: "%.1fT", n / 1e12)
        case 1e9...: return String(format: "%.1fB", n / 1e9)
        case 1e6...: return String(format: "%.1fM", n / 1e6)
        case 1e3...: return String(format: "%.1fK", n / 1e3)
        default: return String(Int(n))
        }
    }

    static func usd(_ n: Double) -> String {
        n >= 100 ? String(format: "$%.0f", n) : String(format: "$%.2f", n)
    }

    static func parallel(_ p: Double?) -> String {
        guard let p else { return "—" }
        return String(format: "%.1f×", p)
    }

    static func ago(_ ms: Double?) -> String {
        guard let ms else { return "never" }
        let date = Date(timeIntervalSince1970: ms / 1000)
        if Date().timeIntervalSince(date) < 60 { return "just now" }
        return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: Date())
    }
}
