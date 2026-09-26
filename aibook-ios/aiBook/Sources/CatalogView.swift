import SwiftUI

@MainActor
final class CatalogViewModel: ObservableObject {
    @Published var titles: [Title] = []
    @Published var loading = true
    @Published var error: String?

    func load() async {
        loading = true
        error = nil
        do {
            titles = try await APIClient.shared.listTitles()
        } catch {
            self.error = "Couldn't load the library."
        }
        loading = false
    }
}

struct CatalogView: View {
    @StateObject private var vm = CatalogViewModel()

    private let columns = [
        GridItem(.flexible(), spacing: 16),
        GridItem(.flexible(), spacing: 16),
    ]

    var body: some View {
        NavigationStack {
            Group {
                if vm.loading {
                    ProgressView()
                } else if let error = vm.error {
                    VStack(spacing: 16) {
                        Text(error).foregroundStyle(.red)
                        Button("Retry") { Task { await vm.load() } }
                    }
                } else {
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 16) {
                            ForEach(vm.titles) { title in
                                TitleTile(title: title)
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("aiBook")
            .navigationDestination(for: Title.self) { title in
                ReaderView(titleId: title.id)
            }
        }
        .task {
            if vm.titles.isEmpty { await vm.load() }
        }
    }
}

private struct TitleTile: View {
    let title: Title

    var body: some View {
        if title.locked {
            tile
                .overlay(alignment: .top) {
                    Text("🔒 Coming soon")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(.black.opacity(0.55))
                }
                .opacity(0.9)
        } else {
            NavigationLink(value: title) { tile }
                .buttonStyle(.plain)
        }
    }

    private var tile: some View {
        VStack(alignment: .leading, spacing: 8) {
            AsyncImage(url: MediaURL.resolve(title.cover)) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Rectangle().fill(.gray.opacity(0.2))
                }
            }
            .frame(height: 220)
            .frame(maxWidth: .infinity)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: 12))

            Text(title.title).font(.headline).lineLimit(2)
            Text(title.author).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
        }
    }
}
