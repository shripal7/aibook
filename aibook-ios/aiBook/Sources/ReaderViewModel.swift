import Foundation
import SwiftUI

@MainActor
final class ReaderViewModel: ObservableObject {
    let titleId: String

    @Published var loading = true
    @Published var loadError: String?

    @Published var beats: [Beat] = []
    @Published var personas: [PersonaConfig] = []
    @Published var agentStatus = AgentStatus(ollamaReachable: false, model: "")

    @Published var feed: [FeedItem] = []
    @Published var revealedCount = 0
    @Published var autoAdvance = true
    @Published var activeAgent = NARRATOR
    @Published var beatPosition = 1
    @Published var sending = false

    @Published var visuals: [Int: VisualizeResponse] = [:]
    @Published var visualizing: Set<Int> = []

    @Published var auditEntries: [AuditEntry] = []

    @Published var recapQuiz: RecapQuizData?
    @Published var quizResults: [String: QuizGradeResponse] = [:]

    private var idCounter = 0
    private var autoAdvanceTask: Task<Void, Never>?

    private let autoAdvanceSeconds: UInt64 = 4

    init(titleId: String) {
        self.titleId = titleId
        // UI tests pass this so the walkthrough can drive personas on a stable beat.
        if ProcessInfo.processInfo.arguments.contains("-uitestNoAutoAdvance") {
            autoAdvance = false
        }
    }

    var finished: Bool { !beats.isEmpty && revealedCount >= beats.count }

    var unlockedAgents: [String] {
        var result = [NARRATOR]
        for p in personas where p.id == "opportunity" || agentStatus.ollamaReachable {
            result.append(p.id)
        }
        return result
    }

    func label(for agent: String) -> String {
        if agent == NARRATOR { return "Narrator" }
        return personas.first(where: { $0.id == agent })?.label ?? agent
    }

    private func nextId() -> String {
        idCounter += 1
        return String(idCounter)
    }

    func load() async {
        loading = true
        loadError = nil
        do {
            let loadedBeats = try await APIClient.shared.listBeats(titleId)
            personas = (try? await APIClient.shared.personas(titleId)) ?? []
            agentStatus = (try? await APIClient.shared.agentStatus()) ?? AgentStatus(ollamaReachable: false, model: "")
            auditEntries = (try? await APIClient.shared.auditSeed(titleId)) ?? []
            beats = loadedBeats
            feed = []
            if let first = loadedBeats.first {
                feed = [.beat(first)]
                revealedCount = 1
                beatPosition = first.index
            } else {
                revealedCount = 0
            }
            activeAgent = NARRATOR
            loading = false
            scheduleAutoAdvance()
        } catch {
            loadError = "Couldn't open this title."
            loading = false
        }
    }

    func scheduleAutoAdvance() {
        autoAdvanceTask?.cancel()
        guard autoAdvance, !sending, !beats.isEmpty, revealedCount < beats.count else { return }
        autoAdvanceTask = Task { [weak self] in
            guard let self else { return }
            try? await Task.sleep(nanoseconds: self.autoAdvanceSeconds * 1_000_000_000)
            if Task.isCancelled { return }
            self.revealNext()
        }
    }

    func revealNext() {
        guard revealedCount < beats.count else { return }
        let next = beats[revealedCount]
        feed.append(.beat(next))
        revealedCount += 1
        beatPosition = next.index
        Task { try? await APIClient.shared.setBeatPosition(titleId, beatIndex: next.index) }
        scheduleAutoAdvance()
    }

    func setAutoAdvance(_ enabled: Bool) {
        autoAdvance = enabled
        if enabled { scheduleAutoAdvance() } else { autoAdvanceTask?.cancel() }
    }

    func selectAgent(_ agent: String) { activeAgent = agent }

    func send(_ raw: String) {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !sending else { return }
        feed.append(.user(id: nextId(), text: text))
        sending = true
        autoAdvanceTask?.cancel()
        let agent = activeAgent
        Task {
            defer {
                sending = false
                scheduleAutoAdvance()
            }
            if agent == NARRATOR {
                do {
                    let r = try await APIClient.shared.chat(titleId, query: text, beatIndex: beatPosition)
                    feed.append(.chat(id: nextId(), r))
                    if let a = r.auditEntry { prependAudit(a) }
                } catch {
                    feed.append(.chat(id: nextId(), ChatResponse(
                        answer: "⚠️ Couldn't reach the book just now. Try again.",
                        citations: [], spoilerGated: false, requestId: "", auditEntry: nil)))
                }
            } else {
                do {
                    let r = try await APIClient.shared.sendAgentMessage(titleId, agentType: agent, beatIndex: beatPosition, message: text)
                    feed.append(.agent(id: nextId(), agentType: agent, text: r.response))
                    if let a = r.auditEntry { prependAudit(a) }
                } catch {
                    feed.append(.agent(id: nextId(), agentType: agent, text: "⚠️ That persona is unavailable right now."))
                }
            }
        }
    }

    func visualizeBeat(_ beatIndex: Int) {
        guard visuals[beatIndex] == nil, !visualizing.contains(beatIndex) else { return }
        visualizing.insert(beatIndex)
        Task {
            defer { visualizing.remove(beatIndex) }
            if let r = try? await APIClient.shared.visualize(titleId, beatIndex: beatPosition, targetBeat: beatIndex) {
                visuals[beatIndex] = r
                if let a = r.auditEntry { prependAudit(a) }
            }
        }
    }

    func loadRecapQuizIfNeeded() {
        guard recapQuiz == nil else { return }
        Task {
            if let q = try? await APIClient.shared.recapQuiz(titleId) { recapQuiz = q }
        }
    }

    func gradeMcq(_ questionId: String, choiceIndex: Int) {
        guard quizResults[questionId] == nil else { return }
        Task {
            if let r = try? await APIClient.shared.gradeMcq(titleId, questionId: questionId, choiceIndex: choiceIndex) {
                quizResults[questionId] = r
            }
        }
    }

    func gradeShort(_ questionId: String, text: String) {
        guard quizResults[questionId] == nil else { return }
        Task {
            if let r = try? await APIClient.shared.gradeShort(titleId, questionId: questionId, text: text) {
                quizResults[questionId] = r
            }
        }
    }

    private func prependAudit(_ entry: AuditEntry) {
        auditEntries.insert(entry, at: 0)
    }
}
