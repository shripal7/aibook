import SwiftUI

struct ReaderView: View {
    @StateObject private var vm: ReaderViewModel
    @State private var input = ""
    @State private var showAudit = false

    init(titleId: String) {
        _vm = StateObject(wrappedValue: ReaderViewModel(titleId: titleId))
    }

    var body: some View {
        Group {
            if vm.loading {
                ProgressView()
            } else if let error = vm.loadError {
                VStack(spacing: 16) {
                    Text(error).foregroundStyle(.red)
                    Button("Retry") { Task { await vm.load() } }
                }
            } else {
                readerBody
            }
        }
        .navigationTitle("aiBook")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showAudit = true
                } label: {
                    Image(systemName: "shield.lefthalf.filled")
                }
                .accessibilityLabel("RPG receipts")
            }
        }
        .sheet(isPresented: $showAudit) {
            RpgAuditSheetView(entries: vm.auditEntries)
        }
        .task { if vm.beats.isEmpty { await vm.load() } }
    }

    private var readerBody: some View {
        VStack(spacing: 0) {
            progressHeader
            Divider()
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(vm.feed) { item in
                            feedRow(item)
                        }
                        if vm.finished {
                            RecapQuizView(vm: vm)
                        }
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding()
                }
                .onChange(of: vm.feed.count) { _ in
                    withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
                }
                .onChange(of: vm.finished) { _ in
                    withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if !vm.finished { inputBar }
        }
    }

    private var progressHeader: some View {
        let total = vm.beats.count
        let shown = min(vm.revealedCount, total)
        let minutesElapsed = max(1, Int((Double(vm.revealedCount) * 4000.0 / 60000.0).rounded()))
        let totalMinutes = max(1, Int((Double(total) * 4000.0 / 60000.0).rounded()))
        return HStack {
            Text("Beat \(shown) of \(total) · ~\(minutesElapsed) of ~\(totalMinutes) min")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Toggle("Auto-advance", isOn: Binding(
                get: { vm.autoAdvance },
                set: { vm.setAutoAdvance($0) }
            ))
            .toggleStyle(.switch)
            .fixedSize()
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private func feedRow(_ item: FeedItem) -> some View {
        switch item {
        case .beat(let beat):
            BeatMessageView(beat: beat, vm: vm)
        case .user(_, let text):
            HStack {
                Spacer(minLength: 40)
                bubble(text, background: Color.accentColor, foreground: .white)
            }
        case .chat(_, let response):
            chatBubble(response)
        case .agent(_, _, let text):
            HStack {
                bubble(text, background: Color.gray.opacity(0.15), foreground: .primary)
                Spacer(minLength: 40)
            }
        }
    }

    private func chatBubble(_ response: ChatResponse) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 8) {
                Text(response.answer)
                if response.spoilerGated { SpoilerBadge() }
                ForEach(response.citations, id: \.passageId) { c in
                    CitationChipView(citation: c)
                }
            }
            .padding(12)
            .background(Color.gray.opacity(0.15))
            .foregroundStyle(.primary)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            Spacer(minLength: 40)
        }
    }

    private func bubble(_ text: String, background: Color, foreground: Color) -> some View {
        Text(text)
            .padding(12)
            .background(background)
            .foregroundStyle(foreground)
            .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var inputBar: some View {
        VStack(alignment: .leading, spacing: 6) {
            AgentPickerView(vm: vm)
            HStack {
                TextField(vm.activeAgent == NARRATOR ? "Ask about the book…" : "Message \(vm.activeAgent)…",
                          text: $input, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...4)
                    .disabled(vm.sending)
                    .accessibilityIdentifier("composer")
                Button {
                    vm.send(input)
                    input = ""
                } label: {
                    Image(systemName: "paperplane.fill")
                }
                .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty || vm.sending)
                .accessibilityLabel("Send")
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }
}
