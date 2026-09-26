package dev.aibook.ui.reader

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.mutableStateListOf
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.aibook.data.AiBookRepository
import dev.aibook.data.model.AgentStatus
import dev.aibook.data.model.AuditEntry
import dev.aibook.data.model.Beat
import dev.aibook.data.model.ChatResponse
import dev.aibook.data.model.PersonaConfig
import dev.aibook.data.model.QuizGradeResponse
import dev.aibook.data.model.RecapQuizData
import dev.aibook.data.model.VisualizeResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import javax.inject.Inject

const val NARRATOR = "narrator"

sealed interface ReaderLoad {
    data object Loading : ReaderLoad
    data object Ready : ReaderLoad
    data class Error(val message: String) : ReaderLoad
}

@HiltViewModel
class ReaderViewModel @Inject constructor(
    private val repository: AiBookRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    val titleId: String = checkNotNull(savedStateHandle.get<String>("titleId"))

    var load by mutableStateOf<ReaderLoad>(ReaderLoad.Loading)
        private set

    var beats by mutableStateOf<List<Beat>>(emptyList())
        private set
    var personas by mutableStateOf<List<PersonaConfig>>(emptyList())
        private set
    var agentStatus by mutableStateOf(AgentStatus())
        private set

    val feed: SnapshotStateList<FeedItem> = mutableStateListOf()

    var revealedCount by mutableStateOf(0)
        private set
    var autoAdvance by mutableStateOf(true)
        private set
    var activeAgent by mutableStateOf(NARRATOR)
        private set
    var beatPosition by mutableStateOf(1)
        private set
    var sending by mutableStateOf(false)
        private set

    // Per-beat visualize results and in-flight set.
    var visuals by mutableStateOf<Map<Int, VisualizeResponse>>(emptyMap())
        private set
    var visualizing by mutableStateOf<Set<Int>>(emptySet())
        private set

    // Client-accumulated RPG audit log (newest first): seed entries + entries from this session.
    var auditEntries by mutableStateOf<List<AuditEntry>>(emptyList())
        private set

    // Recap quiz.
    var recapQuiz by mutableStateOf<RecapQuizData?>(null)
        private set
    var quizResults by mutableStateOf<Map<String, QuizGradeResponse>>(emptyMap())
        private set

    private var idCounter = 0
    private fun nextId(): String = (idCounter++).toString()

    val finished: Boolean
        get() = beats.isNotEmpty() && revealedCount >= beats.size

    val unlockedAgents: List<String>
        get() = buildList {
            add(NARRATOR)
            personas.forEach { p ->
                if (p.id == "opportunity" || agentStatus.ollamaReachable) add(p.id)
            }
        }

    init {
        loadReader()
    }

    fun loadReader() {
        viewModelScope.launch {
            load = ReaderLoad.Loading
            try {
                val beatsDeferred = async { repository.listBeats(titleId) }
                val personasDeferred = async { runCatching { repository.getPersonas(titleId) }.getOrDefault(emptyList()) }
                val statusDeferred = async { runCatching { repository.getAgentStatus() }.getOrDefault(AgentStatus()) }
                val seedDeferred = async { runCatching { repository.getAuditSeed(titleId) }.getOrDefault(emptyList()) }

                val loadedBeats = beatsDeferred.await()
                personas = personasDeferred.await()
                agentStatus = statusDeferred.await()
                auditEntries = seedDeferred.await() // seed log; new actions prepend to this

                beats = loadedBeats
                feed.clear()
                if (loadedBeats.isNotEmpty()) {
                    feed.add(FeedItem.BeatItem(loadedBeats[0]))
                    revealedCount = 1
                    beatPosition = loadedBeats[0].index
                } else {
                    revealedCount = 0
                }
                activeAgent = NARRATOR
                load = ReaderLoad.Ready
            } catch (t: Throwable) {
                load = ReaderLoad.Error(t.message ?: "Failed to open this title")
            }
        }
    }

    /** Reveal the next beat (used by both the auto-advance timer and the manual Continue button). */
    fun revealNext() {
        if (revealedCount >= beats.size) return
        val next = beats[revealedCount]
        feed.add(FeedItem.BeatItem(next))
        revealedCount += 1
        beatPosition = next.index
        viewModelScope.launch { runCatching { repository.setBeatPosition(titleId, next.index) } }
    }

    fun updateAutoAdvance(enabled: Boolean) {
        autoAdvance = enabled
    }

    fun selectAgent(agent: String) {
        activeAgent = agent
    }

    fun send(rawText: String) {
        val text = rawText.trim()
        if (text.isEmpty() || sending) return
        feed.add(FeedItem.UserItem(nextId(), text))
        sending = true
        viewModelScope.launch {
            try {
                if (activeAgent == NARRATOR) {
                    runCatching { repository.chat(titleId, text, beatPosition) }
                        .onSuccess { resp ->
                            feed.add(FeedItem.ChatItem(nextId(), resp))
                            resp.auditEntry?.let(::prependAudit)
                        }
                        .onFailure {
                            feed.add(
                                FeedItem.ChatItem(
                                    nextId(),
                                    ChatResponse(
                                        answer = "⚠️ Couldn't reach the book just now. Try again.",
                                        requestId = "",
                                    ),
                                ),
                            )
                        }
                } else {
                    runCatching { repository.sendAgentMessage(titleId, activeAgent, beatPosition, text) }
                        .onSuccess { resp ->
                            feed.add(FeedItem.AgentItem(nextId(), activeAgent, resp.response))
                            resp.auditEntry?.let(::prependAudit)
                        }
                        .onFailure {
                            feed.add(
                                FeedItem.AgentItem(
                                    nextId(),
                                    activeAgent,
                                    "⚠️ That persona is unavailable right now.",
                                ),
                            )
                        }
                }
            } finally {
                sending = false
            }
        }
    }

    fun visualizeBeat(beatIndex: Int) {
        if (visuals.containsKey(beatIndex) || visualizing.contains(beatIndex)) return
        visualizing = visualizing + beatIndex
        viewModelScope.launch {
            runCatching { repository.visualize(titleId, beatPosition, targetBeat = beatIndex) }
                .onSuccess { resp ->
                    visuals = visuals + (beatIndex to resp)
                    resp.auditEntry?.let(::prependAudit)
                }
            visualizing = visualizing - beatIndex
        }
    }

    fun loadRecapQuizIfNeeded() {
        if (recapQuiz != null) return
        viewModelScope.launch {
            runCatching { repository.getRecapQuiz(titleId) }
                .onSuccess { recapQuiz = it }
        }
    }

    fun gradeMcq(questionId: String, choiceIndex: Int) {
        if (quizResults.containsKey(questionId)) return
        viewModelScope.launch {
            runCatching { repository.gradeMcq(titleId, questionId, choiceIndex) }
                .onSuccess { quizResults = quizResults + (questionId to it) }
        }
    }

    fun gradeShort(questionId: String, text: String) {
        if (quizResults.containsKey(questionId)) return
        viewModelScope.launch {
            runCatching { repository.gradeShort(titleId, questionId, text) }
                .onSuccess { quizResults = quizResults + (questionId to it) }
        }
    }

    private fun prependAudit(entry: AuditEntry) {
        auditEntries = listOf(entry) + auditEntries
    }
}
