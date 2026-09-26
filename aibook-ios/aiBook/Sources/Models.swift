import Foundation

// Codable models mirroring the aiBook API. The decoder uses
// .convertFromSnakeCase, so snake_case JSON keys map to these camelCase properties.

struct BeatPosition: Codable, Hashable {
    var beatIndex: Int
    var label: String
}

struct ReaderState: Codable, Hashable {
    var beatPosition: BeatPosition
}

struct RightsInfo: Codable, Hashable {
    var status: String
    var source: String
    var aiDerivativeRights: [String]?
    var vaultBytes: Int?
}

struct Title: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var author: String
    var year: Int
    var cover: String
    var locked: Bool
    var category: String?
    var rights: RightsInfo?
    var readerState: ReaderState?
}

struct Citation: Codable, Hashable {
    var passageId: String
    var beatIndex: Int
    var quote: String?
    var quoteTokenLen: Int?
    var fullPassageText: String?
}

struct Beat: Codable, Identifiable, Hashable {
    var index: Int
    var title: String
    var narration: String
    var citations: [Citation]
    var autoVisualSceneId: String?
    var id: Int { index }
}

struct PersonaConfig: Codable, Identifiable, Hashable {
    var id: String
    var label: String
    var chipLabel: String
    var introBeat: Int?
}

struct ConditionedOnRef: Codable, Identifiable, Hashable {
    var id: String
    var kind: String
    var name: String
    var referenceImage: String
}

struct ChatResponse: Codable, Hashable {
    var answer: String
    var citations: [Citation]
    var spoilerGated: Bool
    var requestId: String
    var auditEntry: AuditEntry?
}

struct VisualizeResponse: Codable, Hashable {
    var image: String?
    var promptShown: String?
    var caption: String?
    var conditionedOn: [ConditionedOnRef]
    var spoilerGated: Bool
    var requestId: String
    var auditEntry: AuditEntry?
}

struct VisualBibleStyle: Codable, Hashable {
    var medium: String
    var palette: [String]
    var paletteSwatch: String
}

struct VisualBibleCharacter: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var referenceImage: String
    var descriptors: [String]
}

struct VisualBibleSetting: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var referenceImage: String
}

struct VisualBible: Codable, Hashable {
    var titleId: String
    var style: VisualBibleStyle
    var characters: [VisualBibleCharacter]
    var settings: [VisualBibleSetting]
}

struct QuizCitationRef: Codable, Hashable {
    var passageId: String
    var beatIndex: Int
}

struct QuizQuestion: Codable, Identifiable, Hashable {
    var id: String
    var type: String
    var prompt: String
    var choices: [String]
    var citation: QuizCitationRef
}

struct RecapQuizData: Codable, Hashable {
    var questions: [QuizQuestion]
}

struct QuizGradeResponse: Codable, Hashable {
    var correct: Bool?
    var rationale: String
    var citation: Citation
    var modelAnswer: String?
    var answerIndex: Int?
}

struct ContextPackage: Codable, Hashable {
    var summariesUsed: [String]
    var graphNodesUsed: [String]
    var passagesRetrieved: [String]
    var snippetTokensSent: Int
    var snippetCap: Int
}

struct SpoilerGate: Codable, Hashable {
    var applied: Bool
}

struct AuditEntry: Codable, Hashable, Identifiable {
    var ts: String
    var requestId: String
    var action: String
    var query: String?
    var beatIndex: Int
    var contextPackage: ContextPackage
    var rawFullTextSent: Bool
    var rawTextBytesAvailableInVault: Int
    var rawTextBytesSentToModel: Int
    var spoilerGate: SpoilerGate
    var contextBytesSentToModel: Int?
    var agentCallStatus: String?
    var id: String { requestId }
}

struct AuditEntriesResponse: Codable {
    var entries: [AuditEntry]
}

struct AgentMessageResponse: Codable, Hashable {
    var response: String
    var persona: String
    var requestId: String
    var auditEntry: AuditEntry?
}

struct AgentStatus: Codable, Hashable {
    var ollamaReachable: Bool
    var model: String
}

// MARK: - Request bodies (encoded with .convertToSnakeCase)

struct ChatRequest: Encodable {
    var query: String
    var beatIndex: Int
}

struct VisualizeRequest: Encodable {
    var beatIndex: Int
    var targetBeat: Int?
    var passageId: String?
}

struct AgentMessageRequest: Encodable {
    var message: String
    var beatIndex: Int
}

struct BeatPositionRequest: Encodable {
    var beatIndex: Int
}

/// MCQ sends an Int index, short-answer sends a String — encoded as a raw JSON value.
enum GradeAnswer: Encodable {
    case index(Int)
    case text(String)
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .index(let i): try c.encode(i)
        case .text(let s): try c.encode(s)
        }
    }
}

struct GradeRequest: Encodable {
    var questionId: String
    var response: GradeAnswer
}
