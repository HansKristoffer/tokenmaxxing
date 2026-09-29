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
        if let text = title, model.state?.phase == .ready {
            Label(text, systemImage: "bolt.fill")
                .labelStyle(.titleAndIcon)
        } else {
            Image(systemName: "bolt.fill")
        }
    }

    private var title: String? {
        guard let me = model.state?.me else { return nil }
        let tokens = Format.compact(me.tokensToday)
        let rank = me.rank.map { "#\($0)" }
        switch model.menuBarDisplay {
        case .icon: return nil
        case .tokens: return tokens
        case .rank: return rank ?? tokens
        case .both: return rank.map { "\($0) · \(tokens)" } ?? tokens
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

    static func ago(_ ms: Double?) -> String {
        guard let ms else { return "never" }
        let date = Date(timeIntervalSince1970: ms / 1000)
        if Date().timeIntervalSince(date) < 60 { return "just now" }
        return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: Date())
    }
}
