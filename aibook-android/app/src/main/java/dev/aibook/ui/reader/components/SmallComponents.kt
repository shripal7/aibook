package dev.aibook.ui.reader.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AssistChip
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import dev.aibook.data.model.PersonaConfig
import dev.aibook.ui.reader.NARRATOR
import dev.aibook.ui.theme.SpoilerAmber

@Composable
fun SpoilerBadge(modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        color = SpoilerAmber.copy(alpha = 0.15f),
        contentColor = SpoilerAmber,
        shape = MaterialTheme.shapes.small,
    ) {
        Text(
            "🔒 Beyond your reading position",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
        )
    }
}

@Composable
fun AgentIntroChip(chipLabel: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    AssistChip(
        onClick = onClick,
        label = { Text(chipLabel) },
        modifier = modifier,
    )
}

/**
 * "Talking to: X" picker. Renders nothing when only the narrator is available, mirroring the
 * web AgentPicker.
 */
@Composable
fun AgentPicker(
    personas: List<PersonaConfig>,
    unlockedAgentIds: List<String>,
    activeAgent: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (unlockedAgentIds.size <= 1) return
    var expanded by remember { mutableStateOf(false) }

    fun labelFor(id: String): String =
        if (id == NARRATOR) "Narrator" else personas.firstOrNull { it.id == id }?.label ?: id

    Row(modifier = modifier) {
        TextButton(onClick = { expanded = true }) {
            Text("Talking to: ${labelFor(activeAgent)} ▾")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            unlockedAgentIds.forEach { id ->
                DropdownMenuItem(
                    text = { Text(labelFor(id)) },
                    onClick = {
                        onSelect(id)
                        expanded = false
                    },
                )
            }
        }
    }
}
