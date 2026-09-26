import Foundation

let NARRATOR = "narrator"

/// One entry in the conversation feed (mirrors the web/Android feed item union).
enum FeedItem: Identifiable {
    case beat(Beat)
    case user(id: String, text: String)
    case chat(id: String, ChatResponse)
    case agent(id: String, agentType: String, text: String)

    var id: String {
        switch self {
        case .beat(let b): return "beat-\(b.index)"
        case .user(let id, _): return "user-\(id)"
        case .chat(let id, _): return "chat-\(id)"
        case .agent(let id, _, _): return "agent-\(id)"
        }
    }
}
