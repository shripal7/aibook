import Foundation

/// Base URL of the deployed aiBook Cloudflare Worker (serves /api and /media).
enum Config {
    static let baseURL = URL(string: "https://aibook-api.shri007modani.workers.dev")!
}

/// Resolves server-relative "/media/..." paths against the API base URL for AsyncImage.
enum MediaURL {
    static func resolve(_ path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        if path.hasPrefix("http://") || path.hasPrefix("https://") {
            return URL(string: path)
        }
        return URL(string: path, relativeTo: Config.baseURL)
    }
}
