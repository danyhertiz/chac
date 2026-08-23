document.addEventListener('DOMContentLoaded', () => {
    const binaryContainer = document.querySelector('.binary-container');
    const binaryColumns = 13;

    for (let columnIndex = 0; columnIndex < binaryColumns; columnIndex += 1) {
        const column = document.createElement('div');
        column.className = 'binary-column';
        column.innerHTML = Array.from({ length: 40 }, () => Math.random() > 0.5 ? '1<br>' : '0<br>').join('');
        binaryContainer.appendChild(column);
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

    function closeMenu() {
        menu.classList.remove('is-open');
        backdrop.classList.remove('is-visible');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir menú');
    }

    menu.querySelectorAll('.menu-group').forEach((group) => {
        const parentButton = group.querySelector('.menu-parent');

        parentButton.addEventListener('click', () => {
            const isExpanded = group.classList.toggle('is-expanded');
            parentButton.setAttribute('aria-expanded', String(isExpanded));
        });
    });

    toggle.addEventListener('click', () => {
        const isOpen = menu.classList.toggle('is-open');
        backdrop.classList.toggle('is-visible', isOpen);
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
    });

    backdrop.addEventListener('click', closeMenu);
    menu.querySelectorAll('.submenu button, nav > button').forEach((button) => button.addEventListener('click', closeMenu));
});
