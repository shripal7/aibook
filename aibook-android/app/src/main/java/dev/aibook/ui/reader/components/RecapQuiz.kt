package dev.aibook.ui.reader.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.aibook.data.model.QuizGradeResponse
import dev.aibook.data.model.QuizQuestion
import dev.aibook.ui.reader.ReaderViewModel

@Composable
fun RecapQuiz(viewModel: ReaderViewModel, modifier: Modifier = Modifier) {
    LaunchedEffect(Unit) { viewModel.loadRecapQuizIfNeeded() }
    val quiz = viewModel.recapQuiz
    val results = viewModel.quizResults
    val shortAnswers = remember { mutableStateMapOf<String, String>() }

    Column(
        modifier = modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("How much did you retain?", style = MaterialTheme.typography.titleLarge)

        val questions = quiz?.questions.orEmpty()
        questions.forEach { q ->
            QuestionCard(
                question = q,
                result = results[q.id],
                shortAnswer = shortAnswers[q.id] ?: "",
                onShortAnswerChange = { shortAnswers[q.id] = it },
                onGradeMcq = { idx -> viewModel.gradeMcq(q.id, idx) },
                onGradeShort = { viewModel.gradeShort(q.id, shortAnswers[q.id] ?: "") },
            )
        }

        if (questions.isNotEmpty() && results.size == questions.size) {
            Text(
                "🎉 Nicely done — you finished the book.",
                style = MaterialTheme.typography.titleMedium,
            )
        }
    }
}

@Composable
private fun QuestionCard(
    question: QuizQuestion,
    result: QuizGradeResponse?,
    shortAnswer: String,
    onShortAnswerChange: (String) -> Unit,
    onGradeMcq: (Int) -> Unit,
    onGradeShort: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(question.prompt, fontWeight = FontWeight.SemiBold)

            if (question.type == "mcq") {
                question.choices.forEachIndexed { index, choice ->
                    val isCorrectChoice = result != null && result.answerIndex == index
                    if (isCorrectChoice) {
                        Button(
                            onClick = {},
                            enabled = false,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                disabledContainerColor = MaterialTheme.colorScheme.primary,
                                disabledContentColor = MaterialTheme.colorScheme.onPrimary,
                            ),
                        ) { Text(choice) }
                    } else {
                        OutlinedButton(
                            onClick = { onGradeMcq(index) },
                            enabled = result == null,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text(choice) }
                    }
                }
            } else {
                OutlinedTextField(
                    value = shortAnswer,
                    onValueChange = onShortAnswerChange,
                    enabled = result == null,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Your answer") },
                )
                if (result == null) {
                    Button(onClick = onGradeShort) { Text("Check") }
                }
            }

            if (result != null) {
                ResultBlock(result)
            }
        }
    }
}

@Composable
private fun ResultBlock(result: QuizGradeResponse) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        val prefix = when (result.correct) {
            true -> "✅ Correct. "
            false -> "❌ Not quite. "
            null -> ""
        }
        result.modelAnswer?.let {
            Text("Model answer: $it", style = MaterialTheme.typography.bodyMedium)
        }
        Text(prefix + result.rationale, style = MaterialTheme.typography.bodyMedium)
        CitationChip(result.citation)
    }
}
