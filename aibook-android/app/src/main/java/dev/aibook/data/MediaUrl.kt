package dev.aibook.data

import dev.aibook.BuildConfig

/** Resolves server-relative "/media/..." paths against the configured API base URL for Coil. */
object MediaUrl {
    private val base = BuildConfig.API_BASE_URL.trimEnd('/')

    fun resolve(path: String?): String? {
        if (path.isNullOrBlank()) return null
        if (path.startsWith("http://") || path.startsWith("https://")) return path
        return base + if (path.startsWith("/")) path else "/$path"
    }
}
