const MOVIES_DATA_PATH = 'scripts/movies.json';
const ITEMS_PER_PAGE = 60;
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600' viewBox='0 0 400 600'%3E%3Crect width='400' height='600' fill='%231e1e1e'/%3E%3Ctext x='50%25' y='50%25' fill='%23cccccc' font-family='sans-serif' font-size='24' text-anchor='middle' dominant-baseline='middle'%3ESin póster%3C/text%3E%3C/svg%3E";

function initMovieGallery(root = document) {
    const grid = root.querySelector('#movies-grid');
    if (!grid || grid.dataset.initialized === 'true') return;
    grid.dataset.initialized = 'true';

    const search = root.querySelector('#search-input');
    const genre = root.querySelector('#genre-filter');
    const year = root.querySelector('#year-filter');
    const sort = root.querySelector('#sortSelect');
    const pagination = root.querySelector('#pagination-controls');
    const modal = root.querySelector('#movie-modal');
    const modalPoster = root.querySelector('#modal-poster');
    const modalTitle = root.querySelector('#modal-title');
    const modalYear = root.querySelector('#modal-year');
    const modalGenres = root.querySelector('#modal-genres');
    const modalOverview = root.querySelector('#modal-overview');
    const results = root.querySelector('#resultsCount');
    const state = { movies: [], filtered: [], page: 1, query: '', genre: 'Todos', year: 'all', sort: 'year_desc' };
    const compare = {
        year_desc: (a, b) => Number(b.year) - Number(a.year), year_asc: (a, b) => Number(a.year) - Number(b.year),
        title_asc: (a, b) => (a.title || a.originalTitle || '').localeCompare(b.title || b.originalTitle || '', 'es'),
        title_desc: (a, b) => (b.title || b.originalTitle || '').localeCompare(a.title || a.originalTitle || '', 'es'),
        duration_asc: (a, b) => (a.runtime || 0) - (b.runtime || 0), duration_desc: (a, b) => (b.runtime || 0) - (a.runtime || 0)
    };

    function card(movie) {
        const title = movie.title || movie.originalTitle || 'Título desconocido';
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'movie-card'; button.dataset.movieId = String(movie.tmdbId ?? title);
        button.innerHTML = `<img class="movie-poster" loading="lazy" alt="${title} - cartel"><span class="movie-title"></span><span class="movie-meta"></span>`;
        const image = button.querySelector('img'); image.src = movie.poster ? movie.poster : PLACEHOLDER_IMAGE; image.onerror = () => { image.src = PLACEHOLDER_IMAGE; };
        button.querySelector('.movie-title').textContent = title;
        button.querySelector('.movie-meta').textContent = `${movie.year || '—'}${movie.runtime ? ` • ${movie.runtime} min` : ''}`;
        return button;
    }

    function render() {
        grid.replaceChildren();
        const start = (state.page - 1) * ITEMS_PER_PAGE;
        state.filtered.slice(start, start + ITEMS_PER_PAGE).forEach((movie) => grid.appendChild(card(movie)));
        results.textContent = `Mostrando ${state.filtered.length} película${state.filtered.length === 1 ? '' : 's'}`;
        pagination.replaceChildren();
        const pages = Math.ceil(state.filtered.length / ITEMS_PER_PAGE);
        for (let page = 1; page <= pages; page += 1) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'pagination-button'; button.textContent = page; button.dataset.page = page;
            button.disabled = page === state.page; pagination.appendChild(button);
        }
    }

    function filter() {
        const query = state.query.trim().toLowerCase();
        state.filtered = state.movies.filter((movie) => (movie.title || movie.originalTitle || '').toLowerCase().includes(query)
            && (state.year === 'all' || String(movie.year) === state.year)
            && (state.genre === 'Todos' || (movie.genres || []).includes(state.genre)));
        state.filtered.sort(compare[state.sort]); state.page = 1; render();
    }

    fetch(MOVIES_DATA_PATH).then((response) => response.json()).then((movies) => {
        state.movies = movies; [...new Set(movies.flatMap((movie) => movie.genres || []))].sort().forEach((item) => genre.append(new Option(item, item)));
        [...new Set(movies.map((movie) => movie.year).filter(Boolean))].sort((a, b) => b - a).forEach((item) => year.append(new Option(item, item)));
        filter();
    }).catch(() => { grid.textContent = 'No se pudo cargar el catálogo de películas.'; });

    search.addEventListener('input', () => { state.query = search.value; filter(); });
    genre.addEventListener('change', () => { state.genre = genre.value; filter(); }); year.addEventListener('change', () => { state.year = year.value; filter(); });
    sort.addEventListener('change', () => { state.sort = sort.value; filter(); });
    root.querySelector('#toggleFilters').addEventListener('click', () => root.querySelector('#filtersContainer').classList.toggle('filters-collapsed'));
    pagination.addEventListener('click', (event) => { if (event.target.dataset.page) { state.page = Number(event.target.dataset.page); render(); } });
    grid.addEventListener('click', (event) => {
        const movie = state.filtered.find((item) => String(item.tmdbId ?? (item.title || item.originalTitle)) === event.target.closest('.movie-card')?.dataset.movieId);
        if (!movie) return; const title = movie.title || movie.originalTitle || 'Título desconocido';
        modalPoster.src = movie.poster ? movie.poster : PLACEHOLDER_IMAGE; modalTitle.textContent = title; modalYear.textContent = movie.year || 'Año desconocido';
        modalGenres.replaceChildren(...(movie.genres || []).map((item) => { const chip = document.createElement('span'); chip.className = 'genre-chip'; chip.textContent = item; return chip; }));
        modalOverview.textContent = movie.overview || movie.originalOverview || 'No hay descripción disponible.'; modal.classList.add('visible'); modal.classList.remove('hidden'); modal.setAttribute('aria-hidden', 'false');
    });
    const close = () => { modal.classList.remove('visible'); modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); };
    root.querySelector('.modal-close').addEventListener('click', close); modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
}
