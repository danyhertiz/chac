document.addEventListener('DOMContentLoaded', () => {
    const emojiContainer = document.createElement('div');
    emojiContainer.className = 'emoji-container';
    document.body.prepend(emojiContainer);

    const emojiCount = 50;
    const emojiChars = ['🎮', '🍿', '🎵', '🍕'];

    for (let i = 0; i < emojiCount; i++) {
        const emoji = document.createElement('div');
        emoji.className = 'emoji-flake';

        emoji.innerHTML = emojiChars[Math.floor(Math.random() * emojiChars.length)];

        const size = Math.random() * 20 + 10;
        emoji.style.fontSize = `${size}px`;

        const leftPosition = Math.random() * 100;
        emoji.style.left = `${leftPosition}%`;

        const animationDuration = Math.random() * 10 + 10;
        emoji.style.animationDuration = `${animationDuration}s`;

        const animationDelay = Math.random() * 10;
        emoji.style.animationDelay = `${animationDelay}s`;

        const drift = (Math.random() - 0.5) * 200;
        emoji.style.setProperty('--horizontal-drift', `${drift}px`);

        emojiContainer.appendChild(emoji);
    }
});
