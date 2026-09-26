package dev.aibook.data.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

// Request bodies. camelCase -> snake_case via the SnakeCase Json naming strategy.

@Serializable
data class ChatRequest(
    val query: String,
    val beatIndex: Int,
)

@Serializable
data class VisualizeRequest(
    val beatIndex: Int,
    val passageId: String? = null,
    val targetBeat: Int? = null,
)

@Serializable
data class BeatPositionRequest(
    val beatIndex: Int,
)

@Serializable
data class AgentMessageRequest(
    val message: String,
    val beatIndex: Int,
)

@Serializable
data class QuizGradeRequest(
    val questionId: String,
    // Number index for MCQ, string for short-answer — sent as a raw JSON value.
    val response: JsonElement,
)
