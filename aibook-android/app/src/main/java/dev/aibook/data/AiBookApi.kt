package dev.aibook.data

import dev.aibook.data.model.AgentMessageRequest
import dev.aibook.data.model.AgentMessageResponse
import dev.aibook.data.model.AgentStatus
import dev.aibook.data.model.AuditEntriesResponse
import dev.aibook.data.model.Beat
import dev.aibook.data.model.BeatPosition
import dev.aibook.data.model.BeatPositionRequest
import dev.aibook.data.model.ChatRequest
import dev.aibook.data.model.ChatResponse
import dev.aibook.data.model.PersonaConfig
import dev.aibook.data.model.QuizGradeRequest
import dev.aibook.data.model.QuizGradeResponse
import dev.aibook.data.model.RecapQuizData
import dev.aibook.data.model.RpgProof
import dev.aibook.data.model.Title
import dev.aibook.data.model.VisualBible
import dev.aibook.data.model.VisualizeRequest
import dev.aibook.data.model.VisualizeResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/** Retrofit surface — mirrors frontend/src/api/client.ts exactly. */
interface AiBookApi {

    @GET("api/titles")
    suspend fun listTitles(): List<Title>

    @GET("api/titles/{id}")
    suspend fun getTitle(@Path("id") titleId: String): Title

    @GET("api/titles/{id}/personas")
    suspend fun getPersonas(@Path("id") titleId: String): List<PersonaConfig>

    @GET("api/titles/{id}/beats")
    suspend fun listBeats(@Path("id") titleId: String): List<Beat>

    @GET("api/titles/{id}/beat-position")
    suspend fun getBeatPosition(@Path("id") titleId: String): BeatPosition

    @PUT("api/titles/{id}/beat-position")
    suspend fun setBeatPosition(
        @Path("id") titleId: String,
        @Body body: BeatPositionRequest,
    ): BeatPosition

    @POST("api/titles/{id}/chat")
    suspend fun chat(@Path("id") titleId: String, @Body body: ChatRequest): ChatResponse

    @POST("api/titles/{id}/visualize")
    suspend fun visualize(
        @Path("id") titleId: String,
        @Body body: VisualizeRequest,
    ): VisualizeResponse

    @GET("api/titles/{id}/visual-bible")
    suspend fun getVisualBible(@Path("id") titleId: String): VisualBible

    @GET("api/titles/{id}/recap-quiz")
    suspend fun getRecapQuiz(@Path("id") titleId: String): RecapQuizData

    @POST("api/titles/{id}/recap-quiz/grade")
    suspend fun gradeRecapQuiz(
        @Path("id") titleId: String,
        @Body body: QuizGradeRequest,
    ): QuizGradeResponse

    @GET("api/titles/{id}/audit")
    suspend fun getAudit(@Path("id") titleId: String): AuditEntriesResponse

    @GET("api/titles/{id}/rpg/proof")
    suspend fun getRpgProof(@Path("id") titleId: String): RpgProof

    @POST("api/titles/{id}/agents/{agentType}/message")
    suspend fun sendAgentMessage(
        @Path("id") titleId: String,
        @Path("agentType") agentType: String,
        @Body body: AgentMessageRequest,
    ): AgentMessageResponse

    @GET("api/agents/status")
    suspend fun getAgentStatus(): AgentStatus
}
