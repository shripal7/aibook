import Foundation

/// Async client for the aiBook API — mirrors frontend/src/api/client.ts.
struct APIClient {
    static let shared = APIClient()

    private let session: URLSession = .shared

    private var decoder: JSONDecoder {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }
    private var encoder: JSONEncoder {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }

    private func url(_ path: String) -> URL {
        URL(string: path, relativeTo: Config.baseURL)!
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let (data, _) = try await session.data(from: url(path))
        return try decoder.decode(T.self, from: data)
    }

    private func post<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        var req = URLRequest(url: url(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(body)
        let (data, _) = try await session.data(for: req)
        return try decoder.decode(T.self, from: data)
    }

    @discardableResult
    private func put<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        var req = URLRequest(url: url(path))
        req.httpMethod = "PUT"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(body)
        let (data, _) = try await session.data(for: req)
        return try decoder.decode(T.self, from: data)
    }

    // MARK: - Endpoints

    func listTitles() async throws -> [Title] {
        try await get("api/titles")
    }

    func listBeats(_ titleId: String) async throws -> [Beat] {
        try await get("api/titles/\(titleId)/beats")
    }

    func personas(_ titleId: String) async throws -> [PersonaConfig] {
        try await get("api/titles/\(titleId)/personas")
    }

    func agentStatus() async throws -> AgentStatus {
        try await get("api/agents/status")
    }

    func auditSeed(_ titleId: String) async throws -> [AuditEntry] {
        let resp: AuditEntriesResponse = try await get("api/titles/\(titleId)/audit")
        return resp.entries
    }

    @discardableResult
    func setBeatPosition(_ titleId: String, beatIndex: Int) async throws -> BeatPosition {
        try await put("api/titles/\(titleId)/beat-position", body: BeatPositionRequest(beatIndex: beatIndex))
    }

    func chat(_ titleId: String, query: String, beatIndex: Int) async throws -> ChatResponse {
        try await post("api/titles/\(titleId)/chat", body: ChatRequest(query: query, beatIndex: beatIndex))
    }

    func sendAgentMessage(_ titleId: String, agentType: String, beatIndex: Int, message: String) async throws -> AgentMessageResponse {
        try await post("api/titles/\(titleId)/agents/\(agentType)/message",
                       body: AgentMessageRequest(message: message, beatIndex: beatIndex))
    }

    func visualize(_ titleId: String, beatIndex: Int, targetBeat: Int?) async throws -> VisualizeResponse {
        try await post("api/titles/\(titleId)/visualize",
                       body: VisualizeRequest(beatIndex: beatIndex, targetBeat: targetBeat, passageId: nil))
    }

    func recapQuiz(_ titleId: String) async throws -> RecapQuizData {
        try await get("api/titles/\(titleId)/recap-quiz")
    }

    func gradeMcq(_ titleId: String, questionId: String, choiceIndex: Int) async throws -> QuizGradeResponse {
        try await post("api/titles/\(titleId)/recap-quiz/grade",
                       body: GradeRequest(questionId: questionId, response: .index(choiceIndex)))
    }

    func gradeShort(_ titleId: String, questionId: String, text: String) async throws -> QuizGradeResponse {
        try await post("api/titles/\(titleId)/recap-quiz/grade",
                       body: GradeRequest(questionId: questionId, response: .text(text)))
    }
}
