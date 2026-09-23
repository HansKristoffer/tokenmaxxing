import Foundation
import os

struct HelperError: Error, Sendable {
    let code: String
}

/// Runs the TypeScript helper as a child process and speaks newline-delimited
/// JSON with it. Restarts it with backoff if it dies; `onStart` re-sends `init`.
@MainActor
final class HelperProcess {
    var onMessage: (IncomingMessage) -> Void = { _ in }
    var onStart: () -> Void = {}

    private let executable: URL
    private let logURL: URL
    private var process: Process?
    private var stdin: FileHandle?
    private var nextId = 0
    private var pending: [Int: CheckedContinuation<CommandResult?, Error>] = [:]
    private var restartDelay: Duration = .seconds(1)
    private var stopping = false
    private let log = Logger(subsystem: "dk.hanskristoffer.tokenmaxxing", category: "helper")

    init(executable: URL, logURL: URL) {
        self.executable = executable
        self.logURL = logURL
    }

    func start() {
        stopping = false
        let p = Process()
        p.executableURL = executable
        let inPipe = Pipe()
        let outPipe = Pipe()
        p.standardInput = inPipe
        p.standardOutput = outPipe
        p.standardError = openLog()

        let reader = LineReader()
        outPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            let lines = reader.append(data)
            guard !lines.isEmpty else { return }
            Task { @MainActor in
                for line in lines { self?.receive(line) }
            }
        }
        p.terminationHandler = { [weak self] proc in
            let status = proc.terminationStatus
            Task { @MainActor in self?.terminated(status: status) }
        }

        do {
            try p.run()
        } catch {
            log.error("could not start helper at \(self.executable.path, privacy: .public): \(error)")
            scheduleRestart()
            return
        }
        process = p
        stdin = inPipe.fileHandleForWriting
        onStart()
    }

    func stop() {
        stopping = true
        try? stdin?.close()
        process?.terminate()
    }

    /// Sends a command and waits for its reply. Throws `HelperError` with the helper's error code.
    @discardableResult
    func send(_ command: OutgoingCommand) async throws -> CommandResult? {
        guard let stdin else { throw HelperError(code: "helper_unavailable") }
        nextId += 1
        var cmd = command
        cmd.id = nextId
        var line = try JSONEncoder().encode(cmd)
        line.append(0x0A)
        return try await withCheckedThrowingContinuation { cont in
            pending[cmd.id] = cont
            do {
                try stdin.write(contentsOf: line)
            } catch {
                pending[cmd.id] = nil
                cont.resume(throwing: HelperError(code: "helper_unavailable"))
            }
        }
    }

    private func receive(_ line: Data) {
        guard let msg = try? JSONDecoder().decode(IncomingMessage.self, from: line) else {
            log.error("undecodable helper line: \(String(decoding: line, as: UTF8.self), privacy: .public)")
            return
        }
        if let id = msg.id, let cont = pending.removeValue(forKey: id) {
            if msg.ok == true {
                cont.resume(returning: msg.result)
            } else {
                cont.resume(throwing: HelperError(code: msg.error ?? "internal"))
            }
            return
        }
        restartDelay = .seconds(1)
        onMessage(msg)
    }

    private func terminated(status: Int32) {
        process = nil
        stdin = nil
        for (_, cont) in pending { cont.resume(throwing: HelperError(code: "helper_unavailable")) }
        pending = [:]
        guard !stopping else { return }
        log.error("helper exited with status \(status); restarting")
        scheduleRestart()
    }

    private func scheduleRestart() {
        let delay = restartDelay
        restartDelay = min(restartDelay * 2, .seconds(60))
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: delay)
            guard let self, !self.stopping, self.process == nil else { return }
            self.start()
        }
    }

    private func openLog() -> FileHandle {
        let fm = FileManager.default
        try? fm.createDirectory(at: logURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        // ponytail: log truncated at 5 MB on start, not rotated; add rotation if it's ever needed.
        if let size = try? fm.attributesOfItem(atPath: logURL.path)[.size] as? Int, size > 5_000_000 {
            try? fm.removeItem(at: logURL)
        }
        if !fm.fileExists(atPath: logURL.path) { fm.createFile(atPath: logURL.path, contents: nil) }
        guard let handle = try? FileHandle(forWritingTo: logURL) else { return FileHandle.nullDevice }
        handle.seekToEndOfFile()
        return handle
    }
}

/// Splits a byte stream into lines. Called from the pipe's background queue.
final class LineReader: @unchecked Sendable {
    private var buffer = Data()
    private let lock = NSLock()

    func append(_ data: Data) -> [Data] {
        lock.lock()
        defer { lock.unlock() }
        buffer.append(data)
        var lines: [Data] = []
        while let nl = buffer.firstIndex(of: 0x0A) {
            let line = buffer[buffer.startIndex..<nl]
            if !line.isEmpty { lines.append(Data(line)) }
            buffer.removeSubrange(buffer.startIndex...nl)
        }
        return lines
    }
}
