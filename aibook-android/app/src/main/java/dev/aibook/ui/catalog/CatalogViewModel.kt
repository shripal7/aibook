package dev.aibook.ui.catalog

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.aibook.data.AiBookRepository
import dev.aibook.data.model.Title
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface CatalogUiState {
    data object Loading : CatalogUiState
    data class Success(val titles: List<Title>) : CatalogUiState
    data class Error(val message: String) : CatalogUiState
}

@HiltViewModel
class CatalogViewModel @Inject constructor(
    private val repository: AiBookRepository,
) : ViewModel() {

    var uiState by mutableStateOf<CatalogUiState>(CatalogUiState.Loading)
        private set

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            uiState = CatalogUiState.Loading
            runCatching { repository.listTitles() }
                .onSuccess { uiState = CatalogUiState.Success(it) }
                .onFailure { uiState = CatalogUiState.Error(it.message ?: "Failed to load library") }
        }
    }
}
