import SwiftUI

struct MainView: View {
    @Environment(AppModel.self) private var model
    @Binding var page: Page
    @State private var error: String?

    var body: some View {
        if let state = model.state {
            VStack(alignment: .leading, spacing: 10) {
                if let update = state.update { updateBanner(update) }
                header(state)
                if let battle = state.battle { battleLine(battle) }
                Button {
                    Task { error = await model.openWorld() }
                } label: {
                    Label("Open world", systemImage: "map.fill").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .help("Walk around town, chat, and see everyone's stats")
                ErrorText(message: error)
                Divider()
                leaderboard(state)
                Divider()
                footer(state)
            }
            .padding(14)
        }
    }

    private func updateBanner(_ update: UpdateInfo) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "arrow.down.circle.fill").foregroundStyle(Color.accentColor)
            Text(update.installing ? "Updating to \(update.version)…" : "Version \(update.version) is available")
                .font(.callout)
            Spacer()
            if update.installing {
                ProgressView().controlSize(.small)
            } else {
                Button(update.viaBrew ? "Update" : "Download") {
                    Task { error = await model.installUpdate() }
                }
                .controlSize(.small)
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(8)
        .background(Color.accentColor.opacity(0.12), in: .rect(cornerRadius: 8))
        .help(update.viaBrew ? "Runs brew upgrade; Tokenmaxxing restarts when it's done" : "Opens the release page")
    }

    private func header(_ state: AppState) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(Format.compact(state.me?.tokensToday ?? 0)).font(.system(size: 28, weight: .semibold, design: .rounded))
            Text("tokens today").foregroundStyle(.secondary)
            Spacer()
            VStack(alignment: .trailing, spacing: 0) {
                if let rank = state.me?.rank { Text("#\(rank) in town").font(.headline) }
                if let me = state.me {
                    Text("Lv \(me.level) · \(me.levelTitle)").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
    }

    /// "🏁 Tokenmaxxing · 2nd · 18:42 left · 412M": people battle from their editor, not the world.
    private func battleLine(_ b: Battle) -> some View {
        Button {
            Task { error = await model.openWorld() }
        } label: {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let now = context.date.timeIntervalSince1970 * 1000
                HStack {
                    Text("🏁 \(b.name)").fontWeight(.semibold)
                    if let place = b.place { Text("· \(Format.ordinal(place)) of \(b.players)") }
                    Spacer()
                    Text(Self.battleClock(b, now: now)).monospacedDigit().foregroundStyle(.secondary)
                    Text(Format.compact(b.tokens)).monospacedDigit()
                }
                .frame(maxWidth: .infinity)
            }
        }
        .buttonStyle(.bordered)
        .help("Open the world to watch the battle")
    }

    static func battleClock(_ b: Battle, now: Double) -> String {
        if now < b.startsAt { return "starts in \(Format.clock(b.startsAt - now))" }
        if now < b.endsAt { return "\(Format.clock(b.endsAt - now)) left" }
        return "⏳ counting…"
    }

    private func leaderboard(_ state: AppState) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Today in town").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            if state.leaderboard.allSatisfy(\.isMe) {
                Text("Nobody has run an agent yet today.").font(.callout).foregroundStyle(.secondary).padding(.vertical, 4)
            }
            ForEach(state.leaderboard) { r in
                if r.isMe, r.rank > 10 { Divider().padding(.vertical, 2) }
                if r.tokens > 0 || !r.isMe { row(r) }
            }
        }
    }

    private func row(_ r: LeaderboardRow) -> some View {
        HStack {
            Text("\(r.rank)").monospacedDigit().foregroundStyle(.secondary).frame(width: 22, alignment: .trailing)
            Text(r.name).fontWeight(r.isMe ? .semibold : .regular).lineLimit(1)
            if let company = r.company {
                Text(company).font(.caption).foregroundStyle(.tertiary).lineLimit(1)
            }
            Spacer()
            Text(Format.compact(r.tokens)).monospacedDigit()
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(r.isMe ? Color.accentColor.opacity(0.15) : .clear, in: .rect(cornerRadius: 5))
    }

    private func footer(_ state: AppState) -> some View {
        HStack(spacing: 4) {
            if state.sync.syncing {
                ProgressView().controlSize(.mini)
                Text("Syncing…")
            } else if !state.sync.online {
                Image(systemName: "wifi.slash")
                Text("Offline — will retry")
            } else {
                Text("Synced \(Format.ago(state.sync.lastSyncedAt))")
            }
            Spacer()
            Button("Sync now") { model.syncNow() }.buttonStyle(.link)
            Button {
                page = .settings
            } label: {
                Image(systemName: "gearshape")
            }
            .buttonStyle(.borderless)
            Button {
                model.quit()
            } label: {
                Image(systemName: "power")
            }
            .buttonStyle(.borderless)
            .help("Quit")
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }
}
