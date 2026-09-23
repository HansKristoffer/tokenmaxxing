import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Binding var page: Page

    var body: some View {
        @Bindable var model = model
        VStack(alignment: .leading, spacing: 12) {
            PageHeader(title: "Settings", page: $page)

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
    }
}
