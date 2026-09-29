import SwiftUI

/// A group's timeline: chat messages mixed with race moments, all reactable.
struct ChatView: View {
    @Environment(AppModel.self) private var model
    @Binding var page: Page
    @State private var groupId: Int?
    @State private var text = ""
    @State private var error: String?
    @State private var hovered: Int?
    @State private var pickerHovered = false

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
                LazyVStack(spacing: 2) {
                    if items.isEmpty {
                        Text("Nothing yet today. Say hi.").font(.callout).foregroundStyle(.secondary).padding(.top, 20)
                    }
                    ForEach(Array(items.enumerated()), id: \.element.id) { n, i in
                        // Consecutive messages from one person share a single name label.
                        let prev = n > 0 ? items[n - 1] : nil
                        item(i, showAuthor: !i.isMe && (prev?.isSystem != false || prev?.author != i.author))
                    }
                }
                // Room above the first message for its floating reaction picker.
                .padding(.top, 22)
                .padding(.bottom, 4)
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

    private func item(_ i: ChatItem, showAuthor: Bool) -> some View {
        let alignment: HorizontalAlignment = i.isSystem ? .center : i.isMe ? .trailing : .leading
        return VStack(alignment: alignment, spacing: 2) {
            if i.isSystem {
                Text(i.text).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
            } else {
                if showAuthor { Text(i.author).font(.caption2).foregroundStyle(.secondary) }
                Text(i.text)
                    .textSelection(.enabled)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(i.isMe ? Color.accentColor.opacity(0.2) : Color.secondary.opacity(0.12),
                                in: .rect(cornerRadius: 8))
                    .frame(maxWidth: 250, alignment: Alignment(horizontal: alignment, vertical: .center))
            }
            if !i.reactions.isEmpty { reactions(i) }
        }
        .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
        .padding(.vertical, 3)
        .contentShape(Rectangle())
        .help(Date(timeIntervalSince1970: i.createdAt / 1000).formatted(date: .omitted, time: .shortened))
        // Floats over the row instead of joining its layout, so hovering never moves anything.
        .overlay(alignment: i.isMe ? .topLeading : .topTrailing) {
            if hovered == i.id { picker(i).alignmentGuide(.top) { $0[.bottom] - 8 } }
        }
        .zIndex(hovered == i.id ? 1 : 0)
        .id(i.id)
        // Continuous hover re-claims the row on every move, so leaving the picker can't strand it.
        .onContinuousHover { phase in
            switch phase {
            case .active: if !pickerHovered { hovered = i.id }
            case .ended: if hovered == i.id, !pickerHovered { hovered = nil }
            }
        }
        .contextMenu {
            if i.isMe {
                Button("Delete", role: .destructive) { Task { await model.deleteMessage(i.id) } }
            }
        }
    }

    /// Pills for existing reactions.
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
        }
    }

    /// All six reactions in a fixed toolbar; the ones you've used are highlighted and toggle off.
    private func picker(_ i: ChatItem) -> some View {
        HStack(spacing: 0) {
            ForEach(reactionEmoji, id: \.self) { e in
                let mine = i.reactions.contains { $0.emoji == e && $0.mine }
                Button { Task { await model.react(i.id, e) } } label: {
                    Text(e).font(.callout).frame(width: 24, height: 22)
                        .background(mine ? Color.accentColor.opacity(0.3) : .clear, in: .rect(cornerRadius: 5))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(2)
        .background(.regularMaterial, in: .rect(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).strokeBorder(.separator))
        .shadow(color: .black.opacity(0.15), radius: 3, y: 1)
        .onHover { inside in
            pickerHovered = inside
            if inside { hovered = i.id } else if hovered == i.id { hovered = nil }
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
