document.addEventListener('DOMContentLoaded', () => {
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
        menu.querySelectorAll('.menu-group').forEach((group) => {
            const parentButton = group.querySelector('.menu-parent');

            if (!parentButton) {
                return;
            }

            parentButton.addEventListener('click', () => {
                const isExpanded = group.classList.toggle('is-expanded');
                parentButton.setAttribute('aria-expanded', String(isExpanded));
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
        videojuegos: [
            { file: 'Inicios.md', title: '🕹️ Inicios' },
            { file: 'pc.md', title: 'PC', icon: '../img/historias/videojuegos/steam_logo.png' },
            { file: 'xbox.md', title: 'Xbox', icon: '../img/historias/videojuegos/xb_logo.png' },
            { file: 'playstation.md', title: 'PlayStation', icon: '../img/historias/videojuegos/ps_logo.png' },
            { file: 'nintendo.md', title: 'Nintendo', icon: '../img/historias/videojuegos/n64logo.png' },
            { file: 'favoritos.md', title: '🥇 Mis favoritos' }
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

            header.addEventListener('click', (event) => {
                event.stopPropagation();
                article.classList.toggle('expanded');
            });

            const loadMarkdown = async () => {
                try {
                    const response = await fetch(`../stories/${sectionName}/${encodeURIComponent(filename)}`);
                    if (!response.ok) {
                        throw new Error(`No se pudo cargar ${filename}`);
                    }

                    const markdown = await response.text();
                    const html = marked.parse(markdown)
                        .replace(/src="(?!https?:|\/\/|\/)/g, 'src="../')
                        .replace(/href="(?!https?:|\/\/|\/)/g, 'href="../');

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

    const loadSection = async (sectionName) => {
        if (!mainContent || !storiesMap[sectionName]) {
            return;
        }

        try {
            const response = await fetch(`sections/${sectionName}.html`);
            if (!response.ok) {
                throw new Error(`Sección no encontrada: ${sectionName}`);
            }

            mainContent.innerHTML = await response.text();
            renderStories(sectionName);
        } catch (error) {
            console.error('Error loading section:', error);
            mainContent.innerHTML = `<div class="card"><p>Error al cargar la sección: ${error.message}</p></div>`;
        }
    };

    menu?.querySelectorAll('.submenu button, nav > button').forEach((button) => {
        const sectionName = button.dataset.section || button.textContent.trim().toLowerCase();
        if (!storiesMap[sectionName]) {
            return;
        }

        button.addEventListener('click', () => {
            loadSection(sectionName);
            closeMenu();
        });
    });

    loadSection('videojuegos');
});
