import SwiftUI

enum Page {
    case main, groups, settings
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    @State private var page = Page.main

    var body: some View {
        Group {
            switch model.state?.phase {
            case nil, .starting?:
                ProgressView().padding(40)
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
        .onAppear { model.refresh() }
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
