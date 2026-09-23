import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Binding var page: Page
    @State private var name = ""
    @State private var error: String?

    var body: some View {
        @Bindable var model = model
        VStack(alignment: .leading, spacing: 12) {
            PageHeader(title: "Settings", page: $page)

            Text("Name").font(.subheadline.weight(.semibold))
            HStack {
                TextField("name", text: $name).textFieldStyle(.roundedBorder).onSubmit(rename)
                Button("Save", action: rename)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || name == model.state?.me?.name)
            }
            ErrorText(message: error)

            Divider()
            Toggle("Launch at login", isOn: Binding(get: { model.launchAtLogin }, set: { model.setLaunchAtLogin($0) }))
            Toggle("Show my token count in the menu bar", isOn: $model.showCountInMenuBar)

            Divider()
            Text("Sources").font(.subheadline.weight(.semibold))
            ForEach(model.state?.sources ?? []) { source in
                Toggle(source.label, isOn: Binding(
                    get: { source.enabled },
                    set: { on in Task { await model.setSource(source.id, enabled: on) } }
                ))
            }

            Divider()
            HStack {
                if let name = model.state?.me?.name { Text("Signed in as \(name)").foregroundStyle(.secondary) }
                Spacer()
                Button("Sign out", role: .destructive) { Task { await model.signOut() } }
            }
            Text("tokenmaxxing \(model.state?.version ?? "")").font(.caption).foregroundStyle(.tertiary)
        }
        .toggleStyle(.switch)
        .padding(14)
        .onAppear { name = model.state?.me?.name ?? "" }
    }

    private func rename() {
        Task {
            error = await model.rename(to: name)
            if error == nil, let saved = model.state?.me?.name { name = saved }
        }
    }
}
