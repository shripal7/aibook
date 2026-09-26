package dev.aibook.ui.reader

import dev.aibook.data.model.Beat
import dev.aibook.data.model.ChatResponse

/** One entry in the conversation feed (mirrors the web ConversationFeed item union). */
sealed interface FeedItem {
    val key: String

    data class BeatItem(val beat: Beat) : FeedItem {
        override val key: String = "beat-${beat.index}"
    }

    data class UserItem(val id: String, val text: String) : FeedItem {
        override val key: String = "user-$id"
    }

    data class ChatItem(val id: String, val response: ChatResponse) : FeedItem {
        override val key: String = "chat-$id"
    }

    data class AgentItem(val id: String, val agentType: String, val text: String) : FeedItem {
        override val key: String = "agent-$id"
    }
}
