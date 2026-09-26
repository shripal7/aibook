package dev.aibook.ui.reader

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import dev.aibook.data.model.ChatResponse
import dev.aibook.ui.common.ErrorBox
import dev.aibook.ui.common.LoadingBox
import dev.aibook.ui.reader.components.BeatMessage
import dev.aibook.ui.reader.components.AgentPicker
import dev.aibook.ui.reader.components.CitationChip
import dev.aibook.ui.reader.components.RecapQuiz
import dev.aibook.ui.reader.components.RpgAuditSheet
import dev.aibook.ui.reader.components.SpoilerBadge
import kotlinx.coroutines.delay
import kotlin.math.max
import kotlin.math.roundToInt

private const val AUTO_ADVANCE_MS = 4000L

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReaderScreen(
    onBack: () -> Unit,
    viewModel: ReaderViewModel = hiltViewModel(),
) {
    var showAudit by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("aiBook", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Library")
                    }
                },
                actions = {
                    IconButton(onClick = { showAudit = true }) {
                        Text("🛡")
                    }
                },
            )
        },
        bottomBar = {
            if (viewModel.load is ReaderLoad.Ready && !viewModel.finished) {
                InputBar(viewModel)
            }
        },
    ) { padding ->
        when (val state = viewModel.load) {
            is ReaderLoad.Loading -> LoadingBox(Modifier.padding(padding))
            is ReaderLoad.Error -> ErrorBox(state.message, viewModel::loadReader, Modifier.padding(padding))
            is ReaderLoad.Ready -> ReaderBody(viewModel, Modifier.padding(padding))
        }
    }

    if (showAudit) {
        RpgAuditSheet(entries = viewModel.auditEntries, onDismiss = { showAudit = false })
    }
}

@Composable
private fun ReaderBody(viewModel: ReaderViewModel, modifier: Modifier = Modifier) {
    val listState = rememberLazyListState()

    // Auto-advance timer: resets whenever a dependency changes (matches ConversationFeed.tsx).
    LaunchedEffect(viewModel.revealedCount, viewModel.autoAdvance, viewModel.sending, viewModel.beats.size) {
        if (viewModel.autoAdvance && !viewModel.sending &&
            viewModel.beats.isNotEmpty() && viewModel.revealedCount < viewModel.beats.size
        ) {
            delay(AUTO_ADVANCE_MS)
            viewModel.revealNext()
        }
    }

    // Keep the newest item in view.
    LaunchedEffect(viewModel.feed.size, viewModel.finished) {
        val target = viewModel.feed.size - if (viewModel.finished) 0 else 1
        if (target >= 0) listState.animateScrollToItem(target.coerceAtLeast(0))
    }

    Column(modifier) {
        ProgressHeader(viewModel)
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(count = viewModel.feed.size, key = { viewModel.feed[it].key }) { i ->
                FeedRow(viewModel.feed[i], viewModel)
            }
            if (viewModel.finished) {
                item(key = "recap-quiz") { RecapQuiz(viewModel) }
            }
        }
    }
}

@Composable
private fun ProgressHeader(viewModel: ReaderViewModel) {
    val total = viewModel.beats.size
    val shown = minOf(viewModel.revealedCount, total)
    val minutesElapsed = max(1, (viewModel.revealedCount * AUTO_ADVANCE_MS / 60000.0).roundToInt())
    val totalMinutes = max(1, (total * AUTO_ADVANCE_MS / 60000.0).roundToInt())
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            "Beat $shown of $total · ~$minutesElapsed of ~$totalMinutes min",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = viewModel.autoAdvance, onCheckedChange = viewModel::updateAutoAdvance)
            Text("Auto-advance", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun FeedRow(item: FeedItem, viewModel: ReaderViewModel) {
    when (item) {
        is FeedItem.BeatItem -> BeatMessage(item.beat, viewModel)
        is FeedItem.UserItem -> Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
        ) {
            Bubble(color = MaterialTheme.colorScheme.primary, contentColor = MaterialTheme.colorScheme.onPrimary) {
                Text(item.text)
            }
        }
        is FeedItem.ChatItem -> ChatBubble(item.response)
        is FeedItem.AgentItem -> Row(Modifier.fillMaxWidth()) {
            Bubble(color = MaterialTheme.colorScheme.surfaceVariant, contentColor = MaterialTheme.colorScheme.onSurface) {
                Text(item.text)
            }
        }
    }
}

@Composable
private fun ChatBubble(response: ChatResponse) {
    Row(Modifier.fillMaxWidth()) {
        Bubble(color = MaterialTheme.colorScheme.surfaceVariant, contentColor = MaterialTheme.colorScheme.onSurface) {
            Column {
                Text(response.answer)
                if (response.spoilerGated) {
                    SpoilerBadge(Modifier.padding(top = 8.dp))
                }
                response.citations.forEach { CitationChip(it, Modifier.padding(top = 8.dp)) }
            }
        }
    }
}

@Composable
private fun Bubble(
    color: androidx.compose.ui.graphics.Color,
    contentColor: androidx.compose.ui.graphics.Color,
    content: @Composable () -> Unit,
) {
    Surface(
        color = color,
        contentColor = contentColor,
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.widthIn(max = 320.dp),
    ) {
        Box(Modifier.padding(12.dp)) { content() }
    }
}

@Composable
private fun InputBar(viewModel: ReaderViewModel) {
    var text by remember { mutableStateOf("") }
    val placeholder = if (viewModel.activeAgent == NARRATOR) {
        "Ask about the book…"
    } else {
        "Message ${viewModel.activeAgent}…"
    }

    fun submit() {
        if (text.isNotBlank() && !viewModel.sending) {
            viewModel.send(text)
            text = ""
        }
    }

    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
        AgentPicker(
            personas = viewModel.personas,
            unlockedAgentIds = viewModel.unlockedAgents,
            activeAgent = viewModel.activeAgent,
            onSelect = viewModel::selectAgent,
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                placeholder = { Text(placeholder) },
                enabled = !viewModel.sending,
                modifier = Modifier.weight(1f),
                maxLines = 4,
            )
            IconButton(onClick = ::submit, enabled = text.isNotBlank() && !viewModel.sending) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
            }
        }
    }
}
