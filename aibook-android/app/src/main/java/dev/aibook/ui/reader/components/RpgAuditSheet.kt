package dev.aibook.ui.reader.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.aibook.data.model.AuditEntry
import dev.aibook.ui.theme.SpoilerAmber
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RpgAuditSheet(
    entries: List<AuditEntry>,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        val totalRawBytes = entries.sumOf { it.rawTextBytesSentToModel }
        val vaultBytes = entries.firstOrNull()?.rawTextBytesAvailableInVault ?: 0
        val snippetCap = entries.firstOrNull()?.contextPackage?.snippetCap ?: 60

        Column(Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp)) {
            Text("RPG receipts", style = MaterialTheme.typography.titleLarge)

            Card(Modifier.fillMaxWidth().padding(vertical = 12.dp)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        "Raw text: ${if (totalRawBytes == 0) "SEALED" else "EXPOSED"}",
                        color = if (totalRawBytes == 0) MaterialTheme.colorScheme.primary else SpoilerAmber,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "$totalRawBytes bytes of raw text sent to the model this session",
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        "Vault holds ${format(vaultBytes)} bytes · ${entries.size} requests logged · snippet cap $snippetCap tokens",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (entries.isEmpty()) {
                Text("No requests yet this session.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(entries, key = { it.requestId }) { entry -> AuditRow(entry) }
                }
            }
        }
    }
}

@Composable
private fun AuditRow(entry: AuditEntry) {
    var expanded by remember { mutableStateOf(false) }
    Card(Modifier.fillMaxWidth().clickable { expanded = !expanded }) {
        Column(Modifier.padding(12.dp)) {
            val gated = if (entry.spoilerGate.applied) " · gated" else ""
            Text(
                "${entry.action} · Beat ${entry.beatIndex} · ${entry.rawTextBytesSentToModel} raw bytes sent$gated",
                fontWeight = FontWeight.Medium,
            )
            if (expanded) {
                entry.query?.let {
                    Text("Query: \"$it\"", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
                }
                val cp = entry.contextPackage
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.small,
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                ) {
                    Text(
                        buildString {
                            appendLine("summaries_used: ${cp.summariesUsed}")
                            appendLine("graph_nodes_used: ${cp.graphNodesUsed}")
                            appendLine("passages_retrieved: ${cp.passagesRetrieved}")
                            appendLine("snippet_tokens_sent: ${cp.snippetTokensSent}")
                            append("snippet_cap: ${cp.snippetCap}")
                            entry.contextBytesSentToModel?.let { append("\ncontext_bytes_sent_to_model: $it") }
                            entry.agentCallStatus?.let { append("\nagent_call_status: $it") }
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }
        }
    }
}

private fun format(n: Int): String = String.format(Locale.US, "%,d", n)
