import SwiftUI

/// Sign up once; after that the app is just the background sync and a button that opens the world.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @State private var height: CGFloat = 0

    var body: some View {
        Group {
            switch model.state?.phase {
            case nil, .starting?:
                ProgressView().padding(40).frame(maxWidth: .infinity)
            case .onboarding?:
                OnboardingView()
            case .ready?:
                OpenWorldView()
            }
        }
        // MenuBarExtra grows its window but never shrinks it (onboarding → the button), so size it here.
        .fixedSize(horizontal: false, vertical: true)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
        .background(FitWindowHeight(height: height))
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

struct OpenWorldView: View {
    @Environment(AppModel.self) private var model
    @State private var error: String?

    var body: some View {
        VStack(spacing: 8) {
            Button {
                Task { error = await model.openWorld() }
            } label: {
                Label("Open world", systemImage: "map.fill").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            ErrorText(message: error)
            Button("Quit") { model.quit() }
                .buttonStyle(.link)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(14)
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
