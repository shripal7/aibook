package dev.aibook.data.model

import kotlinx.serialization.Serializable

// Response models mirroring the aiBook API (backend/models.py / frontend/src/types.ts).
// The Json instance in NetworkModule uses SnakeCase naming, so camelCase properties map to
// snake_case JSON keys automatically.

@Serializable
data class BeatPosition(
    val beatIndex: Int,
    val label: String,
)

@Serializable
data class ReaderState(
    val beatPosition: BeatPosition,
)

@Serializable
data class RightsInfo(
    val status: String,
    val source: String,
    val aiDerivativeRights: List<String> = emptyList(),
    val vaultBytes: Int = 0,
)

@Serializable
data class Title(
    val id: String,
    val title: String,
    val author: String,
    val year: Int,
    val cover: String,
    val locked: Boolean = false,
    val category: String = "literary",
    val rights: RightsInfo? = null,
    val readerState: ReaderState? = null,
)

@Serializable
data class Citation(
    val passageId: String,
    val beatIndex: Int,
    val quote: String = "",
    val quoteTokenLen: Int = 0,
    val fullPassageText: String = "",
)

@Serializable
data class Beat(
    val index: Int,
    val title: String,
    val narration: String,
    val citations: List<Citation> = emptyList(),
    val autoVisualSceneId: String? = null,
)

@Serializable
data class PersonaConfig(
    val id: String,
    val label: String,
    val chipLabel: String,
    val introBeat: Int? = null,
)

@Serializable
data class ConditionedOnRef(
    val id: String,
    val kind: String,
    val name: String,
    val referenceImage: String,
)

@Serializable
data class ChatResponse(
    val answer: String,
    val citations: List<Citation> = emptyList(),
    val spoilerGated: Boolean = false,
    val requestId: String,
    val auditEntry: AuditEntry? = null,
)

@Serializable
data class VisualizeResponse(
    val image: String? = null,
    val promptShown: String? = null,
    val caption: String? = null,
    val conditionedOn: List<ConditionedOnRef> = emptyList(),
    val spoilerGated: Boolean = false,
    val requestId: String,
    val auditEntry: AuditEntry? = null,
)

@Serializable
data class VisualBibleStyle(
    val medium: String,
    val palette: List<String> = emptyList(),
    val paletteSwatch: String,
)

@Serializable
data class VisualBibleCharacter(
    val id: String,
    val name: String,
    val referenceImage: String,
    val descriptors: List<String> = emptyList(),
)

@Serializable
data class VisualBibleSetting(
    val id: String,
    val name: String,
    val referenceImage: String,
)

@Serializable
data class VisualBible(
    val titleId: String,
    val style: VisualBibleStyle,
    val characters: List<VisualBibleCharacter> = emptyList(),
    val settings: List<VisualBibleSetting> = emptyList(),
)

@Serializable
data class QuizCitationRef(
    val passageId: String,
    val beatIndex: Int,
)

@Serializable
data class QuizQuestion(
    val id: String,
    val type: String,
    val prompt: String,
    val choices: List<String> = emptyList(),
    val citation: QuizCitationRef,
)

@Serializable
data class RecapQuizData(
    val questions: List<QuizQuestion> = emptyList(),
)

@Serializable
data class QuizGradeResponse(
    val correct: Boolean? = null,
    val rationale: String,
    val citation: Citation,
    val modelAnswer: String? = null,
    val answerIndex: Int? = null,
)

@Serializable
data class ContextPackage(
    val summariesUsed: List<String> = emptyList(),
    val graphNodesUsed: List<String> = emptyList(),
    val passagesRetrieved: List<String> = emptyList(),
    val snippetTokensSent: Int = 0,
    val snippetCap: Int = 0,
)

@Serializable
data class SpoilerGate(
    val applied: Boolean = false,
)

@Serializable
data class AuditEntry(
    val ts: String,
    val requestId: String,
    val action: String,
    val query: String? = null,
    val beatIndex: Int,
    val contextPackage: ContextPackage,
    val rawFullTextSent: Boolean = false,
    val rawTextBytesAvailableInVault: Int = 0,
    val rawTextBytesSentToModel: Int = 0,
    val spoilerGate: SpoilerGate = SpoilerGate(),
    val contextBytesSentToModel: Int? = null,
    val agentCallStatus: String? = null,
)

@Serializable
data class AuditEntriesResponse(
    val entries: List<AuditEntry> = emptyList(),
)

@Serializable
data class RpgProof(
    val rawTextSealed: Boolean = true,
    val totalRequests: Int = 0,
    val totalRawBytesSent: Int = 0,
    val rawTextBytesAvailableInVault: Int = 0,
    val snippetCap: Int = 0,
)

@Serializable
data class AgentMessageResponse(
    val response: String,
    val persona: String,
    val requestId: String,
    val auditEntry: AuditEntry? = null,
)

@Serializable
data class AgentStatus(
    val ollamaReachable: Boolean = false,
    val model: String = "",
)
