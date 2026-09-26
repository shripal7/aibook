package dev.aibook.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = BrandBlue,
    onPrimary = Paper,
    background = Paper,
    onBackground = Ink,
    surface = Paper,
    onSurface = Ink,
    surfaceVariant = SurfaceVariantLight,
    onSurfaceVariant = Muted,
)

private val DarkColors = darkColorScheme(
    primary = BrandBlueDark,
    onPrimary = Paper,
    background = PaperDark,
    onBackground = Paper,
    surface = SurfaceDark,
    onSurface = Paper,
    surfaceVariant = SurfaceDark,
    onSurfaceVariant = Muted,
)

@Composable
fun AiBookTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = AiBookTypography,
        content = content,
    )
}
