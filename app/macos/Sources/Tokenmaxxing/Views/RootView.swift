import SwiftUI

enum Page {
    case main, groups, settings
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    @State private var page = Page.main
    @State private var height: CGFloat = 0

    var body: some View {
        Group {
            switch model.state?.phase {
            case nil, .starting?:
                ProgressView().padding(40).frame(maxWidth: .infinity)
            case .onboarding?:
                OnboardingView()
            case .ready?:
                switch page {
                case .main: MainView(page: $page)
                case .groups: GroupsView(page: $page)
                case .settings: SettingsView(page: $page)
                }
            }
        }
        // Size to the content's real height; MenuBarExtra grows its window but never shrinks it,
        // so FitWindowHeight resizes the window itself (state arriving, rows loading, switching pages).
        .fixedSize(horizontal: false, vertical: true)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
        .background(FitWindowHeight(height: height))
        .onAppear { model.refresh() }
    }
}

/// Resizes the hosting window to `height`, keeping its top edge pinned under the menu bar.
private struct FitWindowHeight: NSViewRepresentable {
    let height: CGFloat

    func makeNSView(context: Context) -> NSView { NSView() }

    func updateNSView(_ view: NSView, context: Context) {
        // Defer until the view is in its window and SwiftUI has finished its own layout pass.
        DispatchQueue.main.async {
            guard let window = view.window, height > 0 else { return }
            var frame = window.frame
            let target = window.frameRect(forContentRect: NSRect(x: 0, y: 0, width: frame.width, height: height)).height
            guard abs(frame.height - target) > 0.5 else { return }
            frame.origin.y += frame.height - target
            frame.size.height = target
            window.setFrame(frame, display: true)
        }
    }
}

/// Header row with a back button, for the secondary pages.
struct PageHeader: View {
    let title: String
    @Binding var page: Page

    var body: some View {
        HStack {
            Button {
                page = .main
            } label: {
                Image(systemName: "chevron.left")
            }
            .buttonStyle(.borderless)
            Text(title).font(.headline)
            Spacer()
        }
    }
}

struct ErrorText: View {
    let message: String?

    var body: some View {
        if let message {
            Text(message).font(.caption).foregroundStyle(.red)
        }
    }
}
