package dev.aibook.data

import dev.aibook.data.model.AgentMessageRequest
import dev.aibook.data.model.AgentMessageResponse
import dev.aibook.data.model.AgentStatus
import dev.aibook.data.model.AuditEntry
import dev.aibook.data.model.Beat
import dev.aibook.data.model.ChatRequest
import dev.aibook.data.model.ChatResponse
import dev.aibook.data.model.PersonaConfig
import dev.aibook.data.model.QuizGradeRequest
import dev.aibook.data.model.QuizGradeResponse
import dev.aibook.data.model.RecapQuizData
import dev.aibook.data.model.RpgProof
import dev.aibook.data.model.Title
import dev.aibook.data.model.VisualizeRequest
import dev.aibook.data.model.VisualizeResponse
import kotlinx.serialization.json.JsonPrimitive
import javax.inject.Inject
import javax.inject.Singleton

/** Thin wrapper over [AiBookApi]; ViewModels wrap calls in runCatching for error handling. */
@Singleton
class AiBookRepository @Inject constructor(
    private val api: AiBookApi,
) {
    suspend fun listTitles(): List<Title> = api.listTitles()

    suspend fun listBeats(titleId: String): List<Beat> = api.listBeats(titleId)

    suspend fun getPersonas(titleId: String): List<PersonaConfig> = api.getPersonas(titleId)

    suspend fun getAgentStatus(): AgentStatus = api.getAgentStatus()

    suspend fun setBeatPosition(titleId: String, beatIndex: Int) =
        api.setBeatPosition(titleId, dev.aibook.data.model.BeatPositionRequest(beatIndex))

    suspend fun chat(titleId: String, query: String, beatIndex: Int): ChatResponse =
        api.chat(titleId, ChatRequest(query = query, beatIndex = beatIndex))

    suspend fun sendAgentMessage(
        titleId: String,
        agentType: String,
        beatIndex: Int,
        message: String,
    ): AgentMessageResponse =
        api.sendAgentMessage(titleId, agentType, AgentMessageRequest(message, beatIndex))

    suspend fun visualize(
        titleId: String,
        beatIndex: Int,
        targetBeat: Int? = null,
        passageId: String? = null,
    ): VisualizeResponse =
        api.visualize(
            titleId,
            VisualizeRequest(beatIndex = beatIndex, targetBeat = targetBeat, passageId = passageId),
        )

    suspend fun getRecapQuiz(titleId: String): RecapQuizData = api.getRecapQuiz(titleId)

    suspend fun gradeMcq(titleId: String, questionId: String, choiceIndex: Int): QuizGradeResponse =
        api.gradeRecapQuiz(titleId, QuizGradeRequest(questionId, JsonPrimitive(choiceIndex)))

    suspend fun gradeShort(titleId: String, questionId: String, text: String): QuizGradeResponse =
        api.gradeRecapQuiz(titleId, QuizGradeRequest(questionId, JsonPrimitive(text)))

    suspend fun getRpgProof(titleId: String): RpgProof = api.getRpgProof(titleId)

    /** Seed audit entries (newest first); the live log accumulates client-side thereafter. */
    suspend fun getAuditSeed(titleId: String): List<AuditEntry> = api.getAudit(titleId).entries
}
