import SwiftUI

struct RpgAuditSheetView: View {
    let entries: [AuditEntry]
    @Environment(\.dismiss) private var dismiss

    private var totalRawBytes: Int { entries.reduce(0) { $0 + $1.rawTextBytesSentToModel } }
    private var vaultBytes: Int { entries.first?.rawTextBytesAvailableInVault ?? 0 }
    private var snippetCap: Int { entries.first?.contextPackage.snippetCap ?? 60 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Raw text: \(totalRawBytes == 0 ? "SEALED" : "EXPOSED")")
                            .font(.headline)
                            .foregroundStyle(totalRawBytes == 0 ? Color.accentColor : Color.orange)
                        Text("\(totalRawBytes) bytes of raw text sent to the model this session")
                            .font(.title3.weight(.semibold))
                        Text("Vault holds \(vaultBytes.formatted()) bytes · \(entries.count) requests logged · snippet cap \(snippetCap) tokens")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.gray.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    if entries.isEmpty {
                        Text("No requests yet this session.").foregroundStyle(.secondary)
                    } else {
                        ForEach(entries) { entry in
                            AuditRow(entry: entry)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("RPG receipts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct AuditRow: View {
    let entry: AuditEntry
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                expanded.toggle()
            } label: {
                Text("\(entry.action) · Beat \(entry.beatIndex) · \(entry.rawTextBytesSentToModel) raw bytes sent" + (entry.spoilerGate.applied ? " · gated" : ""))
                    .font(.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)

            if expanded {
                if let query = entry.query {
                    Text("Query: \"\(query)\"").font(.subheadline)
                }
                Text(contextDump(entry.contextPackage, entry: entry))
                    .font(.system(.footnote, design: .monospaced))
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.gray.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.gray.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func contextDump(_ cp: ContextPackage, entry: AuditEntry) -> String {
        var lines = [
            "summaries_used: \(cp.summariesUsed)",
            "graph_nodes_used: \(cp.graphNodesUsed)",
            "passages_retrieved: \(cp.passagesRetrieved)",
            "snippet_tokens_sent: \(cp.snippetTokensSent)",
            "snippet_cap: \(cp.snippetCap)",
        ]
        if let cb = entry.contextBytesSentToModel { lines.append("context_bytes_sent_to_model: \(cb)") }
        if let st = entry.agentCallStatus { lines.append("agent_call_status: \(st)") }
        return lines.joined(separator: "\n")
    }
}
