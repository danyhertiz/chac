(() => {
    'use strict';

    const enToDino = {
        A: 'U', E: 'O', I: 'A', O: 'E', U: 'I',
        M: 'M', Y: 'O',
        B: 'R', C: 'S', D: 'T', F: 'V', G: 'W', H: 'X', J: 'Z', K: 'B', L: 'C', N: 'D',
        P: 'F', Q: 'G', R: 'H', S: 'J', T: 'K', V: 'L', W: 'N', X: 'P', Z: 'Q'
    };

    const dinoToEn = Object.fromEntries(
        Object.entries(enToDino).map(([english, dino]) => [dino, english])
    );

    const translate = (text, dictionary) => [...text.toUpperCase()]
        .map((character) => dictionary[character] || character)
        .join('');

    window.toDino = (text) => translate(text || '', enToDino);
    window.toEnglish = (text) => translate(text || '', dinoToEn);

    window.initDinoTranslator = () => {
        const container = document.getElementById('dino-translator');
        if (!container || container.dataset.initialized === 'true') return;

        const input = container.querySelector('#dino-input');
        const mode = container.querySelector('#dino-mode');
        const output = container.querySelector('#dino-output');
        container.dataset.initialized = 'true';

        const update = () => {
            output.textContent = mode.value === 'en-to-dino'
                ? window.toDino(input.value)
                : window.toEnglish(input.value);
        };

        input.addEventListener('input', update);
        mode.addEventListener('change', update);
        update();
    };
})();
