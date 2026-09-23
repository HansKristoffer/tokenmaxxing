import SwiftUI

struct OnboardingView: View {
    @Environment(AppModel.self) private var model
    @State private var name = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Welcome to tokenmaxxing").font(.headline)
            Text("Pick a name. It's what your friends see on the leaderboard.")
                .font(.callout)
                .foregroundStyle(.secondary)
            TextField("name", text: $name)
                .textFieldStyle(.roundedBorder)
                .onSubmit(submit)
            ErrorText(message: error)
            HStack {
                Button("Quit") { model.quit() }
                Spacer()
                Button(action: submit) {
                    if busy { ProgressView().controlSize(.small) } else { Text("Continue") }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            Text("Only token counts, model names and timestamps leave this Mac. Never message content.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(16)
    }

    private func submit() {
        busy = true
        Task {
            error = await model.signUp(name: name)
            busy = false
        }
    }
}
