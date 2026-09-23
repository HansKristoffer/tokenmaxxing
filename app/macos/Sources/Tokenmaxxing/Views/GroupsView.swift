import SwiftUI

struct GroupsView: View {
    @Environment(AppModel.self) private var model
    @Binding var page: Page
    @State private var newName = ""
    @State private var code = ""
    @State private var error: String?
    @State private var copied: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            PageHeader(title: "Groups", page: $page)

            if let groups = model.state?.groups, !groups.isEmpty {
                VStack(spacing: 6) {
                    ForEach(groups) { row($0) }
                }
            } else {
                Text("You're not in any groups yet.").foregroundStyle(.secondary)
            }

            Divider()
            Text("Join with a code").font(.subheadline.weight(.semibold))
            HStack {
                TextField("K7QM-2XRP-9D", text: $code).textFieldStyle(.roundedBorder).onSubmit(join)
                Button("Join", action: join).disabled(code.isEmpty)
            }

            Text("Create a group").font(.subheadline.weight(.semibold))
            HStack {
                TextField("Name", text: $newName).textFieldStyle(.roundedBorder).onSubmit(create)
                Button("Create", action: create).disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            ErrorText(message: error)
        }
        .padding(14)
    }

    private func row(_ g: GroupInfo) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(g.name).fontWeight(.medium)
                    if g.isOwner { Image(systemName: "crown.fill").font(.caption2).foregroundStyle(.yellow) }
                }
                Text("\(g.code) · \(g.memberCount) \(g.memberCount == 1 ? "member" : "members")")
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button(copied == g.id ? "Copied" : "Copy invite") {
                model.copyInvite(g)
                copied = g.id
            }
            Menu {
                if g.isOwner {
                    Button("New invite code") { Task { error = await model.rotateCode(g.id) } }
                }
                Button("Leave group", role: .destructive) { Task { error = await model.leaveGroup(g.id) } }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
        }
    }

    private func join() {
        Task {
            error = await model.joinGroup(code: code)
            if error == nil { code = "" }
        }
    }

    private func create() {
        Task {
            error = await model.createGroup(name: newName)
            if error == nil { newName = "" }
        }
    }
}
