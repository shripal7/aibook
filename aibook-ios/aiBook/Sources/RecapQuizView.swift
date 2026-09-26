import SwiftUI

struct RecapQuizView: View {
    @ObservedObject var vm: ReaderViewModel
    @State private var shortAnswers: [String: String] = [:]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("How much did you retain?").font(.title2.weight(.semibold))

            let questions = vm.recapQuiz?.questions ?? []
            ForEach(questions) { question in
                QuestionCard(
                    question: question,
                    result: vm.quizResults[question.id],
                    shortAnswer: Binding(
                        get: { shortAnswers[question.id] ?? "" },
                        set: { shortAnswers[question.id] = $0 }
                    ),
                    onGradeMcq: { index in vm.gradeMcq(question.id, choiceIndex: index) },
                    onGradeShort: { vm.gradeShort(question.id, text: shortAnswers[question.id] ?? "") }
                )
            }

            if !questions.isEmpty && vm.quizResults.count == questions.count {
                Text("🎉 Nicely done — you finished the book.")
                    .font(.headline)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onAppear { vm.loadRecapQuizIfNeeded() }
    }
}

private struct QuestionCard: View {
    let question: QuizQuestion
    let result: QuizGradeResponse?
    @Binding var shortAnswer: String
    let onGradeMcq: (Int) -> Void
    let onGradeShort: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(question.prompt).font(.body.weight(.semibold))

            if question.type == "mcq" {
                ForEach(Array(question.choices.enumerated()), id: \.offset) { index, choice in
                    Button {
                        onGradeMcq(index)
                    } label: {
                        Text(choice).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(result?.answerIndex == index ? .green : .accentColor)
                    .disabled(result != nil)
                }
            } else {
                TextField("Your answer", text: $shortAnswer)
                    .textFieldStyle(.roundedBorder)
                    .disabled(result != nil)
                if result == nil {
                    Button("Check", action: onGradeShort)
                }
            }

            if let result {
                resultBlock(result)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.gray.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func resultBlock(_ result: QuizGradeResponse) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let modelAnswer = result.modelAnswer {
                Text("Model answer: \(modelAnswer)").font(.subheadline)
            }
            let prefix: String = {
                switch result.correct {
                case .some(true): return "✅ Correct. "
                case .some(false): return "❌ Not quite. "
                case .none: return ""
                }
            }()
            Text(prefix + result.rationale).font(.subheadline)
            CitationChipView(citation: result.citation)
        }
    }
}
