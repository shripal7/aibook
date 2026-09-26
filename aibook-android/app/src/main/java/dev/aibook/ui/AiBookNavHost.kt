package dev.aibook.ui

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import dev.aibook.ui.catalog.CatalogScreen
import dev.aibook.ui.reader.ReaderScreen

object Routes {
    const val CATALOG = "catalog"
    const val READER = "reader/{titleId}"
    fun reader(titleId: String) = "reader/$titleId"
}

@Composable
fun AiBookNavHost() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = Routes.CATALOG) {
        composable(Routes.CATALOG) {
            CatalogScreen(onOpenTitle = { id -> nav.navigate(Routes.reader(id)) })
        }
        composable(
            route = Routes.READER,
            arguments = listOf(navArgument("titleId") { type = NavType.StringType }),
        ) {
            ReaderScreen(onBack = { nav.popBackStack() })
        }
    }
}
