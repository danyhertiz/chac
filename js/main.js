const initializeSite = () => {
    if (window.siteInitialized) {
        return;
    }

    if (window.authenticated !== true) {
        return;
    }

    window.siteInitialized = true;

    const binaryContainer = document.querySelector('.binary-container');
    const binaryColumns = 13;

    if (binaryContainer) {
        for (let columnIndex = 0; columnIndex < binaryColumns; columnIndex += 1) {
            const column = document.createElement('div');
            column.className = 'binary-column';
            column.innerHTML = Array.from({ length: 40 }, () => Math.random() > 0.5 ? '1<br>' : '0<br>').join('');
            binaryContainer.appendChild(column);
        }
    }

    const emojiContainer = document.createElement('div');
    emojiContainer.className = 'emoji-container';
    document.body.prepend(emojiContainer);

    const emojiChars = ['🎮', '💾', '🎵', '🛸'];
    for (let index = 0; index < 50; index += 1) {
        const emoji = document.createElement('div');
        emoji.className = 'emoji-flake';
        emoji.textContent = emojiChars[Math.floor(Math.random() * emojiChars.length)];
        emoji.style.fontSize = `${Math.random() * 20 + 10}px`;
        emoji.style.left = `${Math.random() * 100}%`;
        emoji.style.animationDuration = `${Math.random() * 10 + 10}s`;
        emoji.style.animationDelay = `${Math.random() * 10}s`;
        emoji.style.setProperty('--horizontal-drift', `${(Math.random() - 0.5) * 200}px`);
        emojiContainer.appendChild(emoji);
    }

    const menu = document.querySelector('.side-menu');
    const toggle = document.querySelector('.menu-toggle');
    const backdrop = document.querySelector('.menu-backdrop');
    const mainContent = document.getElementById('main-content');

    function closeMenu() {
        if (!menu || !backdrop || !toggle) {
            return;
        }

        menu.classList.remove('is-open');
        backdrop.classList.remove('is-visible');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir menú');
    }

    if (menu) {
        const menuGroups = menu.querySelectorAll('.menu-group');

        menuGroups.forEach((group) => {
            const parentButton = group.querySelector('.menu-parent');

            if (!parentButton) {
                return;
            }

            parentButton.addEventListener('click', () => {
                const isExpanded = group.classList.toggle('is-expanded');
                parentButton.setAttribute('aria-expanded', String(isExpanded));

                if (isExpanded) {
                    menuGroups.forEach((otherGroup) => {
                        if (otherGroup === group) {
                            return;
                        }

                        otherGroup.classList.remove('is-expanded');
                        otherGroup.querySelector('.menu-parent')?.setAttribute('aria-expanded', 'false');
                    });
                }
            });
        });
    }

    if (toggle && menu && backdrop) {
        toggle.addEventListener('click', () => {
            const isOpen = menu.classList.toggle('is-open');
            backdrop.classList.toggle('is-visible', isOpen);
            toggle.setAttribute('aria-expanded', String(isOpen));
            toggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
        });

        backdrop.addEventListener('click', closeMenu);
    }

    const storiesMap = {
        mamita: [
            { file: 'golosinas.md', title: '🍫 Golosinas' },
            { file: 'no_clases.md', title: '🎒 Mañana no hay clases' },
            { file: 'esquema.md', title: '🌷 El esquema de la flor' },
            { file: 'comida.md', title: '🍽️ Comida' }
        ],
        foza: [
            { file: 'Prólogo.md', title: '📖 Prólogo' },
            { file: 'Capítulo 1.md', title: '📖 Capítulo 1' },
            { file: 'Capítulo 2.md', title: '📖 Capítulo 2' },
            { file: 'Capítulo 3.md', title: '📖 Capítulo 3' },
            { file: 'Capítulo 4.md', title: '📖 Capítulo 4' },
            { file: 'Capítulo 5.md', title: '📖 Capítulo 5' },
            { file: 'Capítulo 6.md', title: '📖 Capítulo 6' },
            { file: 'Capítulo 7.md', title: '📖 Capítulo 7' },
            { file: 'Epílogo.md', title: '📖 Epílogo' }
        ],
        informatica: [
            { file: 'inicios_informatica.md', title: 'Inicios en la informática', icon: 'img/iconos/PC_vieja.png' },
            { file: 'mis_pc.md', title: 'Mis computadoras', icon: 'img/iconos/computadora.png' },
        ],
        videojuegos: [
            { file: 'Inicios.md', title: '🕹️ Inicios' },
            { file: 'pc.md', title: 'PC', icon: 'img/historias/videojuegos/steam_logo.png' },
            { file: 'xbox.md', title: 'Xbox', icon: 'img/historias/videojuegos/xb_logo.png' },
            { file: 'playstation.md', title: 'PlayStation', icon: 'img/historias/videojuegos/ps_logo.png' },
            { file: 'nintendo.md', title: 'Nintendo', icon: 'img/historias/videojuegos/n64logo.png' },
            { file: 'favoritos.md', title: '🥇 Mis favoritos' }
        ],
        peliculas: [
            { file: 'sagas.md', title: 'Sagas', icon: 'img/iconos/starwars-ico.png' },
            { file: 'anime.md', title: 'Anime', icon: 'img/iconos/anime.png' },
            { file: 'drama.md', title: 'Drama', icon: 'img/iconos/drama.png' },
            { file: 'suspenso.md', title: 'Suspenso', icon: 'img/iconos/horror.png' },
            { file: 'infantil.md', title: 'Infantiles', icon: 'img/iconos/infantil.png' },
            { file: 'navid.md', title: 'Navideñas', icon: 'img/iconos/navidad.png' },
        ],
        series: [
            { file: 'Dinosaurios.md', title: '🦖 Dinosaurios' },
            { file: 'Heidi.md', title: '🏔️ Heidi' },
            { file: 'Calabozos.md', title: 'Calabozos y Dragones', icon: 'img/iconos/dungeons.png' },
            { file: 'Historias_asombrosas.md', title: 'Historias asombrosas', icon: 'img/iconos/libro-magico.png' },
            { file: 'Cazafantasmas.md', title: 'Los Verdaderos Cazafantasmas', icon: 'img/iconos/ghostbusters.png' },
            { file: 'Simpsons.md', title: 'Los Simpson', icon: 'img/iconos/simpsons-tv.png' },
            { file: 'Hey_Arnold.md', title: 'Hey Arnold', icon: 'img/iconos/arnold.png' },
            { file: 'Escandalosos.md', title: 'Escandalosos', icon: 'img/iconos/polar2.png' },
            { file: 'Maravillosos.md', title: 'Los Años Maravillosos', icon: 'img/iconos/serie-tv.png' },
            { file: 'House.md', title: '🩺 Dr. House' },
            { file: 'Eva.md', title: 'Todo Sobre Eva', icon: 'img/iconos/kdrama.png' },
            { file: 'Beakman.md', title: 'El mundo de Beakman', icon: 'img/iconos/beakman.png' },
            { file: 'Mas_series.md', title: 'Más series', icon: 'img/iconos/serie-tv2.png' },
        ],
        musica: [
            { file: 'Inicios.md', title: '🎵 Inicios en la música' },
            { file: 'Grabadoras.md', title: '📻 Grabadoras' },
        ],
        juguetes: [
            { file: 'camiones.md', title: '🏗️ Maquinaria de construcción' },
            { file: 'Bloques.md', title: '🧱 Cubos y bloques de madera' },
            { file: 'Linternas.md', title: '🔦 Linternas' },
            { file: 'cotidianos.md', title: '🧸 Juguetes cotidianos' },
        ],
        deportes: [
            { file: 'futbol_escuela.md', title: '⚽ Fútbol' },
            { file: 'basquetbol.md', title: '🏀 Basquetbol' },
            { file: 'karate.md', title: '🥋 Karate' },
        ],
        varias: [
            { file: 'fiestas.md', title: '🎉 Fiestas' },
            { file: 'reaccion.md', title: '😲 Reacción retardada' },
        ]
    };

    const prettyTitle = (filename) => {
        const name = filename.replace(/\.md$/i, '').replace(/_/g, ' ');
        return name
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    };

    const storyDirectories = {
        deportes: 'deporte'
    };

    const renderStories = (sectionName) => {
        const storiesContainer = document.getElementById('stories-container');

        if (!storiesContainer) {
            return;
        }

        const stories = storiesMap[sectionName] || [];
        storiesContainer.innerHTML = '';

        stories.forEach((story) => {
            const filename = story.file || story;
            const title = story.title || prettyTitle(filename);
            const icon = story.icon ? `<img src="${story.icon}" class="imagen-icono" alt="${title}">` : '';

            const article = document.createElement('article');
            article.className = 'collapsible-story';
            article.innerHTML = `
                <div class="story-header">
                    <h2>${icon}${title}</h2>
                </div>
                <div class="story-content"></div>
                <button type="button" class="collapse-story-button" aria-label="Colapsar tarjeta">Cerrar</button>
            `;

            const titleIcon = article.querySelector('.story-header h2 img.imagen-icono');
            if (titleIcon) {
                titleIcon.style.cssText = `
                    display: inline-block;
                    width: 1.2em;
                    height: 1.2em;
                    max-width: 1.2em;
                    max-height: 1.2em;
                    margin: 0;
                    padding: 0;
                    vertical-align: text-bottom;
                    object-fit: contain;
                    flex-shrink: 0;
                    line-height: 1;
                    box-shadow: none;
                    border-radius: 0;
                `;
            }

            const header = article.querySelector('.story-header');
            const content = article.querySelector('.story-content');
            const collapseButton = article.querySelector('.collapse-story-button');

            header.addEventListener('click', (event) => {
                event.stopPropagation();
                article.classList.toggle('expanded');
            });

            collapseButton.addEventListener('click', (event) => {
                event.stopPropagation();
                article.classList.remove('expanded');
            });

            const loadMarkdown = async () => {
                try {
                    const storyDirectory = storyDirectories[sectionName] || sectionName;
                    const response = await fetch(`stories/${storyDirectory}/${encodeURIComponent(filename)}`);
                    if (!response.ok) {
                        throw new Error(`No se pudo cargar ${filename}`);
                    }

                    const markdown = await response.text();
                    const html = marked.parse(markdown)
                        .replace(/src="(?!https?:|\/\/|\/)/g, 'src="./')
                        .replace(/href="(?!https?:|\/\/|\/)/g, 'href="./');

                    content.innerHTML = html;
                } catch (error) {
                    console.error('Error loading markdown:', error);
                    content.innerHTML = `<p>Error al cargar la historia: ${error.message}</p>`;
                }
            };

            loadMarkdown();
            storiesContainer.appendChild(article);
        });
    };

    // INICIO: código que inserta contenido en el contenedor principal.
    const staticSections = new Set(['mis_videos', 'mis_episodios', 'mis_peliculas']);
    const routeMap = {
        mamita: 'sections/mamita.html',
        foza: 'sections/foza.html',
        informatica: 'sections/informatica.html',
        videojuegos: 'sections/videojuegos.html',
        peliculas: 'sections/peliculas.html',
        series: 'sections/series.html',
        musica: 'sections/musica.html',
        juguetes: 'sections/juguetes.html',
        deportes: 'sections/deportes.html',
        varias: 'sections/varias.html',
        mis_videos: 'sections/mis_videos.html',
        mis_episodios: 'sections/mis_episodios.html',
        mis_peliculas: 'sections/mis_peliculas.html',
        p_simulador: 'sections/p_simulador.html',
        p_traductordino: 'sections/p_traductordino.html'
    };

    const loadSection = async (sectionName, { updateHistory = false } = {}) => {
        if (!mainContent) {
            return;
        }

        try {
            const sectionFile = routeMap[sectionName];
            if (!sectionFile) {
                throw new Error(`Ruta no encontrada: ${sectionName}`);
            }

            if (updateHistory) {
                const url = new URL(window.location.href);
                url.searchParams.set('page', sectionName);
                window.history.pushState({ page: sectionName }, '', url);
            }

            const response = await fetch(sectionFile);
            if (!response.ok) {
                throw new Error(`Sección no encontrada: ${sectionName}`);
            }

            mainContent.innerHTML = await response.text();
            mainContent.classList.toggle('video-page-main', staticSections.has(sectionName));
            mainContent.classList.toggle('episode-page', sectionName === 'mis_episodios');
            mainContent.classList.toggle('movie-page-main', sectionName === 'mis_peliculas');

            if (storiesMap[sectionName]) {
                renderStories(sectionName);
            }

            if (sectionName === 'mis_peliculas') {
                window.initMovieGallery?.(mainContent);
            }

            if (sectionName === 'p_simulador') {
                window.initDownloadSimulator?.();
            }

            if (sectionName === 'p_traductordino') {
                window.initDinoTranslator?.();
            }
        } catch (error) {
            console.error('Error loading section:', error);
            mainContent.innerHTML = `<div class="card"><p>Error al cargar la sección: ${error.message}</p></div>`;
        }
    };
    // FIN: código que inserta contenido en el contenedor principal.

    menu?.querySelectorAll('.submenu button, nav > button').forEach((button) => {
        const sectionName = button.dataset.section || button.textContent.trim().toLowerCase();
        if (!routeMap[sectionName]) {
            return;
        }

        button.addEventListener('click', () => {
            loadSection(sectionName, { updateHistory: true });
            closeMenu();
        });
    });

    window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.search);
        const page = params.get('page');

        if (page && routeMap[page]) {
            loadSection(page);
        } else {
            window.location.reload();
        }
    });

    const params = new URLSearchParams(window.location.search);
    const initialPage = params.get('page');
    if (initialPage && routeMap[initialPage]) {
        loadSection(initialPage);
    }

};

window.addEventListener('authenticated', initializeSite, { once: true });
if (window.authenticated === true) {
    initializeSite();
}
