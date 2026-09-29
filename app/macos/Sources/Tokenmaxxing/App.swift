import SwiftUI

@main
struct TokenmaxxingApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        MenuBarExtra {
            RootView()
                .environment(model)
                .frame(width: 240)
        } label: {
            Image(systemName: "bolt.fill")
        }
        .menuBarExtraStyle(.window)
    }
}
