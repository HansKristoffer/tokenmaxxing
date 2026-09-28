import SwiftUI

/// A group's timeline: chat messages mixed with race moments, all reactable.
struct ChatView: View {
    @Environment(AppModel.self) private var model
    @Binding var page: Page
    @State private var groupId: Int?
    @State private var text = ""
    @State private var error: String?
    @State private var hovered: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            PageHeader(title: "Chat", page: $page)
            if let groups = model.state?.groups, groups.count > 1 {
                Picker("", selection: $groupId) {
                    ForEach(groups) { Text($0.name).tag(Int?.some($0.id)) }
                }
                .labelsHidden()
            }
            if let groupId {
                timeline
                HStack {
                    TextField("Message", text: $text).textFieldStyle(.roundedBorder).onSubmit { send(groupId) }
                    Button("Send") { send(groupId) }
                        .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                ErrorText(message: error)
            } else {
                Text("Join a group to chat.").foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .onAppear {
            groupId = model.state?.view.groupId ?? model.state?.groups.first?.id
            open()
        }
        .onChange(of: groupId) { open() }
        .onDisappear { Task { await model.setChatOpen(false, groupId: nil) } }
    }

    private var items: [ChatItem] {
        guard let chat = model.state?.chat, chat.groupId == groupId else { return [] }
        return chat.timeline
    }

    private var timeline: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 8) {
                    if items.isEmpty {
                        Text("Nothing yet today. Say hi.").font(.callout).foregroundStyle(.secondary).padding(.top, 20)
                    }
                    ForEach(items) { item($0) }
                }
                .padding(.vertical, 4)
            }
            .frame(height: 320)
            .onChange(of: items.last?.id) { _, id in
                if let id { proxy.scrollTo(id, anchor: .bottom) }
            }
            .onAppear {
                if let id = items.last?.id { proxy.scrollTo(id, anchor: .bottom) }
            }
        }
    }

    private func item(_ i: ChatItem) -> some View {
        let alignment: HorizontalAlignment = i.isSystem ? .center : i.isMe ? .trailing : .leading
        return VStack(alignment: alignment, spacing: 2) {
            if i.isSystem {
                Text(i.text).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
            } else {
                if !i.isMe { Text(i.author).font(.caption2).foregroundStyle(.secondary) }
                Text(i.text)
                    .textSelection(.enabled)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(i.isMe ? Color.accentColor.opacity(0.2) : Color.secondary.opacity(0.12),
                                in: .rect(cornerRadius: 8))
            }
            reactions(i)
        }
        .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
        .id(i.id)
        .contentShape(Rectangle())
        .onHover { inside in
            if inside { hovered = i.id } else if hovered == i.id { hovered = nil }
        }
        .contextMenu {
            if i.isMe {
                Button("Delete", role: .destructive) { Task { await model.deleteMessage(i.id) } }
            }
        }
    }

    /// Pills for existing reactions; the full row of six while hovered.
    private func reactions(_ i: ChatItem) -> some View {
        HStack(spacing: 4) {
            ForEach(i.reactions, id: \.emoji) { r in
                Button { Task { await model.react(i.id, r.emoji) } } label: {
                    Text("\(r.emoji) \(r.count)").font(.caption)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 6)
                .padding(.vertical, 1)
                .background(r.mine ? Color.accentColor.opacity(0.3) : Color.secondary.opacity(0.12), in: .capsule)
            }
            if hovered == i.id {
                ForEach(reactionEmoji.filter { e in !i.reactions.contains { $0.emoji == e } }, id: \.self) { e in
                    Button(e) { Task { await model.react(i.id, e) } }.buttonStyle(.plain).font(.caption)
                }
            }
        }
    }

    private func open() {
        Task { await model.setChatOpen(true, groupId: groupId) }
    }

    private func send(_ groupId: Int) {
        let message = text.trimmingCharacters(in: .whitespaces)
        guard !message.isEmpty else { return }
        Task {
            error = await model.sendMessage(message, groupId: groupId)
            if error == nil { text = "" }
        }
    }
}
