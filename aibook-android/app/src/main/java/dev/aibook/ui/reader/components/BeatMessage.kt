package dev.aibook.ui.reader.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.aibook.data.model.Beat
import dev.aibook.ui.reader.ReaderViewModel

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BeatMessage(
    beat: Beat,
    viewModel: ReaderViewModel,
    modifier: Modifier = Modifier,
) {
    val visual = viewModel.visuals[beat.index]
    val loading = viewModel.visualizing.contains(beat.index)

    // Auto-attach visuals for beats that declare one (mirrors BeatMessage.tsx).
    LaunchedEffect(beat.index) {
        if (beat.autoVisualSceneId != null) viewModel.visualizeBeat(beat.index)
    }

    Column(modifier = modifier.fillMaxWidth()) {
        if (beat.title.isNotBlank()) {
            Text(
                beat.title,
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(bottom = 4.dp),
            )
        }
        Text(beat.narration, style = MaterialTheme.typography.bodyLarge)

        beat.citations.forEach { citation ->
            CitationChip(citation, Modifier.padding(top = 8.dp))
        }

        when {
            visual != null -> VisualCard(visual, Modifier.padding(top = 12.dp))
            loading -> Text(
                "Generating…",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 12.dp),
            )
            beat.autoVisualSceneId == null -> Button(
                onClick = { viewModel.visualizeBeat(beat.index) },
                modifier = Modifier.padding(top = 12.dp),
            ) {
                Text("🖼 Visualize this")
            }
        }

        val introPersonas = viewModel.personas.filter {
            it.introBeat == beat.index && viewModel.agentStatus.ollamaReachable
        }
        if (introPersonas.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(top = 8.dp),
            ) {
                introPersonas.forEach { persona ->
                    AgentIntroChip(
                        chipLabel = persona.chipLabel,
                        onClick = { viewModel.selectAgent(persona.id) },
                    )
                }
            }
        }
    }
}
