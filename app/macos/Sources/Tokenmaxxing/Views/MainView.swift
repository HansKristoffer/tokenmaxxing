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
                controls(state)
                Divider()
                if state.groups.isEmpty {
                    emptyGroups
                } else {
                    leaderboard(state)
                }
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
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(Format.compact(state.me?.tokens ?? 0)).font(.system(size: 28, weight: .semibold, design: .rounded))
                Text("tokens").foregroundStyle(.secondary)
                Spacer()
                if let rank = state.me?.rank, let of = state.me?.of, of > 1 {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text("#\(rank) of \(of)").font(.headline)
                        if let above = state.me?.above {
                            Text("\(Format.gap(above.gap, state.view.sort)) behind \(above.name)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            if let p = state.progress { progress(p) }
            HStack(spacing: 12) {
                Text(Format.usd(state.me?.costUsd ?? 0))
                Label(Format.parallel(state.me?.parallelism), systemImage: "square.stack.3d.up")
                    .help("Average agents running at once while active (needs 1 active hour)")
                if let peak = state.me?.peakAgents, peak > 0 {
                    Text("peak \(peak)").help("Most agents running at the same time")
                }
                if let prs = state.me?.prs, prs > 0 {
                    Text("\(prs) PRs").help("Pull requests you created on GitHub (via gh)")
                }
            }
            .font(.callout)
            .foregroundStyle(.secondary)
        }
    }

    private func progress(_ p: Progress) -> some View {
        HStack(spacing: 8) {
            Text("L\(p.level) \(p.levelTitle)")
                .help("\(Format.compact(p.lifetimeTokens)) lifetime tokens")
            if p.daysWon30 > 0 { Text("👑×\(p.daysWon30)").help("Days won in the last 30") }
            if p.winStreak > 1 { Text("\(p.winStreak) wins in a row") }
            if p.activeStreak > 1 { Text("🔥 \(p.activeStreak)d").help("Days in a row with agents running") }
            if !p.achievements.isEmpty { Text(p.achievements.joined()).help("Achievements") }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    private func controls(_ state: AppState) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Picker("", selection: binding(state, \.range)) {
                    ForEach(RangeKey.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                Picker("", selection: binding(state, \.sort)) {
                    ForEach(SortKey.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                .labelsHidden()
                .frame(width: 90)
            }
            if !state.groups.isEmpty {
                Picker("", selection: binding(state, \.groupId)) {
                    Text("All groups").tag(Int?.none)
                    ForEach(state.groups) { Text($0.name).tag(Int?.some($0.id)) }
                }
                .labelsHidden()
            }
        }
    }

    private func binding<T>(_ state: AppState, _ key: WritableKeyPath<ViewSettings, T>) -> Binding<T> {
        Binding(
            get: { state.view[keyPath: key] },
            set: { value in
                var view = state.view
                view[keyPath: key] = value
                Task { await model.setView(view) }
            }
        )
    }

    private var emptyGroups: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("No groups yet").font(.headline)
            Text("Create a group and share its code, or join a friend's group.")
                .font(.callout)
                .foregroundStyle(.secondary)
            Button("Groups…") { page = .groups }
        }
        .padding(.vertical, 6)
    }

    private func leaderboard(_ state: AppState) -> some View {
        VStack(spacing: 2) {
            ForEach(state.leaderboard) { row(state, $0) }
            if let me = state.me, let rank = me.rank, !state.leaderboard.contains(where: \.isMe) {
                Text("⋯").foregroundStyle(.tertiary)
                row(state, LeaderboardRow(rank: rank, name: me.name, tokens: me.tokens, costUsd: me.costUsd,
                                          parallelism: me.parallelism, peakAgents: me.peakAgents, prs: me.prs, isMe: true,
                                          titles: me.titles, delta: me.delta, level: state.progress?.level ?? 0))
            }
        }
    }

    private func row(_ state: AppState, _ r: LeaderboardRow) -> some View {
        HStack {
            Text("\(r.rank)").monospacedDigit().foregroundStyle(.secondary).frame(width: 22, alignment: .trailing)
            Text(r.name).fontWeight(r.isMe ? .semibold : .regular).lineLimit(1)
            if !r.titles.isEmpty { Text(r.titles.joined()).font(.caption).help("Yesterday's titles") }
            Spacer()
            if let d = r.delta, d != 0 {
                Text("\(Format.arrow(d))\(abs(d))")
                    .font(.caption2)
                    .foregroundStyle(d > 0 ? .green : .red)
                    .help("Places moved in the last hour")
            }
            switch state.view.sort {
            case .tokens: Text(Format.compact(r.tokens)).monospacedDigit()
            case .parallelism: Text(Format.parallel(r.parallelism)).monospacedDigit()
            case .cost: Text(Format.usd(r.costUsd)).monospacedDigit()
            case .prs: Text("\(r.prs)").monospacedDigit()
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(r.isMe ? Color.accentColor.opacity(0.15) : .clear, in: .rect(cornerRadius: 5))
    }

    private func footer(_ state: AppState) -> some View {
        VStack(alignment: .leading, spacing: 6) {
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
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            ErrorText(message: error)
            HStack {
                Button("Dashboard") { Task { error = await model.openDashboard() } }
                Button("Groups") { page = .groups }
                if !state.groups.isEmpty {
                    Button(state.chat.unread > 0 ? "Chat (\(state.chat.unread))" : "Chat") { page = .chat }
                }
                Spacer()
                Button {
                    page = .settings
                } label: {
                    Image(systemName: "gearshape")
                }
                Button {
                    model.quit()
                } label: {
                    Image(systemName: "power")
                }
                .help("Quit")
            }
            .buttonStyle(.borderless)
        }
    }
}
