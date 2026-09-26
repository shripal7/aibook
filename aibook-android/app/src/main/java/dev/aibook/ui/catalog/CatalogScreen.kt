package dev.aibook.ui.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import dev.aibook.data.MediaUrl
import dev.aibook.data.model.Title
import dev.aibook.ui.common.ErrorBox
import dev.aibook.ui.common.LoadingBox

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CatalogScreen(
    onOpenTitle: (String) -> Unit,
    viewModel: CatalogViewModel = hiltViewModel(),
) {
    Scaffold(
        topBar = {
            TopAppBar(title = {
                Column {
                    Text("aiBook", fontWeight = FontWeight.Bold)
                    Text(
                        "Pick a book to finish in one sitting.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            })
        },
    ) { padding ->
        when (val state = viewModel.uiState) {
            is CatalogUiState.Loading -> LoadingBox(Modifier.padding(padding))
            is CatalogUiState.Error -> ErrorBox(state.message, viewModel::load, Modifier.padding(padding))
            is CatalogUiState.Success -> LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                items(state.titles, key = { it.id }) { title ->
                    TitleTile(title = title, onOpen = onOpenTitle)
                }
            }
        }
    }
}

@Composable
private fun TitleTile(title: Title, onOpen: (String) -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !title.locked) { onOpen(title.id) },
    ) {
        Column {
            Box {
                AsyncImage(
                    model = MediaUrl.resolve(title.cover),
                    contentDescription = title.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(0.72f)
                        .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp)),
                )
                if (title.locked) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.45f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "🔒 Coming soon",
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
            Column(Modifier.padding(12.dp)) {
                Text(
                    title.title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    title.author,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
