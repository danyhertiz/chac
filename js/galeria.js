const MOVIES_DATA_PATH = 'scripts/movies.json';
const ITEMS_PER_PAGE = 50;
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600' viewBox='0 0 400 600'%3E%3Crect width='400' height='600' fill='%231e1e1e'/%3E%3Ctext x='50%25' y='50%25' fill='%23cccccc' font-family='Segoe UI,Arial,sans-serif' font-size='24' text-anchor='middle' dominant-baseline='middle'%3ENo poster%3C/text%3E%3C/svg%3E";

const moviesGrid = document.getElementById('movies-grid');
const searchInput = document.getElementById('search-input');
const yearFilter = document.getElementById('year-filter');
const genreFilter = document.getElementById('genre-filter');
const paginationControls = document.getElementById('pagination-controls');
const modalOverlay = document.getElementById('movie-modal');
const modalPoster = document.getElementById('modal-poster');
const modalTitle = document.getElementById('modal-title');
const modalYear = document.getElementById('modal-year');
const modalGenres = document.getElementById('modal-genres');
const modalOverview = document.getElementById('modal-overview');
const modalClose = document.querySelector('.modal-close');

const state = {
    fullMovies: [],
    filteredMovies: [],
    currentPage: 1,
    searchQuery: '',
    selectedYear: 'all',
    selectedGenre: 'all',
};

function debounce(fn, delay = 180) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

function createMovieCard(movie) {
    const displayTitle = movie.title || movie.originalTitle || 'Título desconocido';
    const hasOriginalTitle = movie.originalTitle && movie.originalTitle !== displayTitle;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'movie-card';
    card.dataset.movieId = movie.tmdbId != null ? String(movie.tmdbId) : displayTitle;
    card.title = `Ver detalles de ${displayTitle}`;

    const poster = document.createElement('img');
    poster.className = 'movie-poster';
    poster.src = movie.poster || PLACEHOLDER_IMAGE;
    poster.alt = `${displayTitle} - cartel`;
    poster.loading = 'lazy';
    poster.addEventListener('error', () => {
        poster.src = PLACEHOLDER_IMAGE;
    });

    const title = document.createElement('div');
    title.className = 'movie-title';
    title.textContent = displayTitle;

    card.appendChild(poster);
    card.appendChild(title);

    if (hasOriginalTitle) {
        const originalTitle = document.createElement('div');
        originalTitle.className = 'movie-original-title';
        originalTitle.textContent = movie.originalTitle;
        card.appendChild(originalTitle);
    }

    return card;
}

function renderMovies(movies) {
    moviesGrid.innerHTML = '';

    if (!movies.length) {
        const message = document.createElement('p');
        message.className = 'empty-state';
        message.textContent = 'No se encontraron películas con los filtros actuales.';
        moviesGrid.appendChild(message);
        return;
    }

    const fragment = document.createDocumentFragment();
    movies.forEach((movie) => fragment.appendChild(createMovieCard(movie)));
    moviesGrid.appendChild(fragment);
}

function openModal(movie) {
    const displayTitle = movie.title || movie.originalTitle || 'Título no disponible';
    const originalTitle = movie.originalTitle && movie.originalTitle !== displayTitle ? movie.originalTitle : '';
    const genres = Array.isArray(movie.genres) ? movie.genres.filter(Boolean) : [];

    modalPoster.src = movie.poster || PLACEHOLDER_IMAGE;
    modalPoster.alt = `${displayTitle} - cartel`;
    modalTitle.textContent = displayTitle;

    let originalTitleElement = modalOverlay.querySelector('#modal-original-title');
    if (originalTitle) {
        if (!originalTitleElement) {
            originalTitleElement = document.createElement('p');
            originalTitleElement.id = 'modal-original-title';
            originalTitleElement.className = 'modal-original-title';
            modalTitle.insertAdjacentElement('afterend', originalTitleElement);
        }
        originalTitleElement.textContent = originalTitle;
    } else if (originalTitleElement) {
        originalTitleElement.remove();
    }

    if (genres.length) {
        modalGenres.innerHTML = '';
        genres.forEach((genre) => {
            const genrePill = document.createElement('span');
            genrePill.className = 'genre-chip';
            genrePill.textContent = genre;
            modalGenres.appendChild(genrePill);
        });
        modalGenres.hidden = false;
    } else {
        modalGenres.innerHTML = '';
        modalGenres.hidden = true;
    }

    modalYear.textContent = movie.year ? `Año: ${movie.year}` : 'Año desconocido';
    modalOverview.textContent = movie.overview || movie.originalOverview || 'No hay descripción disponible.';
    modalOverlay.classList.remove('hidden');
    modalOverlay.classList.add('visible');
    modalOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    if (!modalOverlay.classList.contains('visible')) {
        return;
    }
    modalOverlay.classList.remove('visible');
    modalOverlay.classList.add('hidden');
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function showError(message) {
    moviesGrid.innerHTML = `<p class="empty-state">${message}</p>`;
    paginationControls.innerHTML = '';
}

function getPaginatedMovies() {
    const startIndex = (state.currentPage - 1) * ITEMS_PER_PAGE;
    return state.filteredMovies.slice(startIndex, startIndex + ITEMS_PER_PAGE);
}

function setupPagination() {
    const totalPages = Math.max(1, Math.ceil(state.filteredMovies.length / ITEMS_PER_PAGE));
    if (state.currentPage > totalPages) {
        state.currentPage = totalPages;
    }

    const prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.className = 'pagination-button';
    prevButton.textContent = 'Anterior';
    prevButton.disabled = state.currentPage === 1;
    prevButton.dataset.page = String(state.currentPage - 1);

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'pagination-button';
    nextButton.textContent = 'Siguiente';
    nextButton.disabled = state.currentPage === totalPages;
    nextButton.dataset.page = String(state.currentPage + 1);

    const pagesWrapper = document.createElement('div');
    pagesWrapper.className = 'pagination-pages';

    const startPage = Math.max(1, state.currentPage - 2);
    const endPage = Math.min(totalPages, state.currentPage + 2);

    for (let page = startPage; page <= endPage; page += 1) {
        const pageButton = document.createElement('button');
        pageButton.type = 'button';
        pageButton.className = `pagination-button page-number${page === state.currentPage ? ' active' : ''}`;
        pageButton.textContent = String(page);
        pageButton.dataset.page = String(page);
        if (page === state.currentPage) {
            pageButton.disabled = true;
        }
        pagesWrapper.appendChild(pageButton);
    }

    paginationControls.innerHTML = '';
    paginationControls.appendChild(prevButton);
    paginationControls.appendChild(pagesWrapper);
    paginationControls.appendChild(nextButton);
}

function updateFilteredMovies() {
    const titleQuery = state.searchQuery.trim().toLowerCase();
    state.filteredMovies = state.fullMovies.filter((movie) => {
        const matchesTitle = movie.title ? movie.title.toLowerCase().includes(titleQuery) : false;
        const matchesYear = state.selectedYear === 'all' || movie.year === state.selectedYear;
        const movieGenres = Array.isArray(movie.genres) ? movie.genres : [];
        const matchesGenre = state.selectedGenre === 'all' || movieGenres.includes(state.selectedGenre);
        return matchesTitle && matchesYear && matchesGenre;
    });
    state.currentPage = 1;
}

function populateYearFilter() {
    const years = Array.from(new Set(state.fullMovies
        .map((movie) => movie.year)
        .filter(Boolean)))
        .sort((a, b) => Number(b) - Number(a));

    yearFilter.innerHTML = '<option value="all">Todos los años</option>';
    years.forEach((year) => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
}

function populateGenreFilter() {
    const genres = Array.from(new Set(state.fullMovies
        .flatMap((movie) => Array.isArray(movie.genres) ? movie.genres : [])
        .filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    genreFilter.innerHTML = '<option value="all">Todos</option>';
    genres.forEach((genre) => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        genreFilter.appendChild(option);
    });
}

function renderCurrentPage() {
    if (!state.fullMovies.length) {
        return;
    }

    const pagedMovies = getPaginatedMovies();
    renderMovies(pagedMovies);
    setupPagination();
}

async function loadMovies() {
    try {
        const response = await fetch(MOVIES_DATA_PATH);

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status} al cargar ${MOVIES_DATA_PATH}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error('movies.json no contiene una lista de películas válida');
        }

        state.fullMovies = data;
        if (!state.fullMovies.length) {
            showError('No hay películas disponibles en el catálogo.');
            return;
        }

        populateYearFilter();
        populateGenreFilter();
        updateFilteredMovies();
        renderCurrentPage();
    } catch (error) {
        console.error('Error cargando películas:', error);
        showError('Ocurrió un error al cargar la colección de películas.');
    }
}

function handleGridClick(event) {
    const card = event.target.closest('.movie-card');
    if (!card) {
        return;
    }

    const movieId = card.dataset.movieId;
    const movie = state.filteredMovies.find((item) => String(item.tmdbId) === movieId || item.title === movieId);
    if (movie) {
        openModal(movie);
    }
}

function handlePaginationClick(event) {
    const button = event.target.closest('button[data-page]');
    if (!button) {
        return;
    }

    const selectedPage = Number(button.dataset.page);
    if (Number.isNaN(selectedPage) || selectedPage === state.currentPage) {
        return;
    }

    state.currentPage = Math.max(1, selectedPage);
    renderCurrentPage();
}

function handleSearchInput(event) {
    state.searchQuery = event.target.value;
    updateFilteredMovies();
    renderCurrentPage();
}

function handleYearFilterChange(event) {
    state.selectedYear = event.target.value;
    updateFilteredMovies();
    renderCurrentPage();
}

function handleGenreFilterChange(event) {
    state.selectedGenre = event.target.value;
    updateFilteredMovies();
    renderCurrentPage();
}

function handleKeyDown(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
}

function handleOverlayClick(event) {
    if (event.target === modalOverlay) {
        closeModal();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    loadMovies();
    moviesGrid.addEventListener('click', handleGridClick);
    paginationControls.addEventListener('click', handlePaginationClick);
    searchInput.addEventListener('input', debounce(handleSearchInput));
    yearFilter.addEventListener('change', handleYearFilterChange);
    genreFilter.addEventListener('change', handleGenreFilterChange);
    modalOverlay.addEventListener('click', handleOverlayClick);
    modalClose.addEventListener('click', closeModal);
    document.addEventListener('keydown', handleKeyDown);
});
