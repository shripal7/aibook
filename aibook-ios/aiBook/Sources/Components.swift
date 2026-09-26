import SwiftUI

struct SpoilerBadge: View {
    var body: some View {
        Text("🔒 Beyond your reading position")
            .font(.caption.weight(.medium))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.orange.opacity(0.15))
            .foregroundStyle(Color.orange)
            .clipShape(Capsule())
    }
}

struct CitationChipView: View {
    let citation: Citation
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Beat \(citation.beatIndex)")
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.gray.opacity(0.15))
                    .clipShape(Capsule())
                Button(expanded ? "Hide passage" : "Read the full passage →") {
                    expanded.toggle()
                }
                .font(.caption)
            }
            if expanded {
                Text(citation.fullPassageText ?? citation.quote ?? "")
                    .font(.subheadline)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.gray.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}

struct VisualCardView: View {
    let visual: VisualizeResponse

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let image = visual.image {
                AsyncImage(url: MediaURL.resolve(image)) { phase in
                    if let img = phase.image {
                        img.resizable().scaledToFit()
                    } else {
                        Rectangle().fill(.gray.opacity(0.15)).frame(height: 180)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 8))

                if let caption = visual.caption {
                    Text(caption).font(.subheadline)
                }
                if visual.spoilerGated {
                    SpoilerBadge()
                }
                if !visual.conditionedOn.isEmpty {
                    Text("Conditioned on the Visual Bible").font(.caption.weight(.semibold))
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(visual.conditionedOn) { ref in
                                VStack {
                                    AsyncImage(url: MediaURL.resolve(ref.referenceImage)) { phase in
                                        if let img = phase.image {
                                            img.resizable().scaledToFill()
                                        } else {
                                            Rectangle().fill(.gray.opacity(0.15))
                                        }
                                    }
                                    .frame(width: 64, height: 64)
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                                    Text(ref.name)
                                        .font(.caption2)
                                        .frame(width: 72)
                                        .lineLimit(2)
                                        .multilineTextAlignment(.center)
                                }
                            }
                        }
                    }
                    Text("The creature and setting stay consistent across every scene generated for this title.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            } else {
                Text("No scene available for this passage yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.gray.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct BeatMessageView: View {
    let beat: Beat
    @ObservedObject var vm: ReaderViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !beat.title.isEmpty {
                Text(beat.title).font(.headline)
            }
            Text(beat.narration).font(.body)

            ForEach(beat.citations, id: \.passageId) { citation in
                CitationChipView(citation: citation)
            }

            if let visual = vm.visuals[beat.index] {
                VisualCardView(visual: visual)
            } else if vm.visualizing.contains(beat.index) {
                Text("Generating…").font(.subheadline).foregroundStyle(.secondary)
            } else if beat.autoVisualSceneId == nil {
                Button {
                    vm.visualizeBeat(beat.index)
                } label: {
                    Label("Visualize this", systemImage: "photo")
                }
                .buttonStyle(.borderedProminent)
            }

            let intro = vm.personas.filter { $0.introBeat == beat.index && vm.agentStatus.ollamaReachable }
            if !intro.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(intro) { persona in
                            Button(persona.chipLabel) { vm.selectAgent(persona.id) }
                                .buttonStyle(.bordered)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onAppear {
            if beat.autoVisualSceneId != nil { vm.visualizeBeat(beat.index) }
        }
    }
}

struct AgentPickerView: View {
    @ObservedObject var vm: ReaderViewModel

    var body: some View {
        if vm.unlockedAgents.count > 1 {
            Menu {
                ForEach(vm.unlockedAgents, id: \.self) { agent in
                    Button(vm.label(for: agent)) { vm.selectAgent(agent) }
                }
            } label: {
                Text("Talking to: \(vm.label(for: vm.activeAgent)) ▾")
                    .font(.subheadline)
            }
        }
    }
}
