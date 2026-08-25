(function() {
    const enToDino = {
        'A': 'U', 'E': 'O', 'I': 'A', 'O': 'E', 'U': 'I',
        'M': 'M', 'Y': 'O',
        'B': 'R', 'C': 'S', 'D': 'T', 'F': 'V', 'G': 'W', 'H': 'X', 'J': 'Z', 'K': 'B', 'L': 'C', 'N': 'D',
        'P': 'F', 'Q': 'G', 'R': 'H', 'S': 'J', 'T': 'K', 'V': 'L', 'W': 'N', 'X': 'P', 'Z': 'Q'
    };

    const dinoToEn = {};
    for (const en in enToDino) {
        dinoToEn[enToDino[en]] = en;
    }

    function translate(text, map) {
        if (!text) return "";
        return text.toUpperCase().split('').map(char => {
            return map[char] || char;
        }).join('');
    }

    window.toDino = function(text) {
        return translate(text, enToDino);
    };

    window.toEnglish = function(text) {
        return translate(text, dinoToEn);
    };

    window.initDinoTranslator = function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Load CSS if not already loaded (though it should be linked in HTML)
        if (!document.querySelector('link[href="css/dino-translator.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/dino-translator.css';
            document.head.appendChild(link);
        }

        container.innerHTML = `
            <h2>Traductor de idioma Dino</h2>
            <div class="translator-controls">
                <div class="control-group">
                    <label for="dino-mode">Modo de traducción</label>
                    <select id="dino-mode">
                        <option value="en-to-dino">Inglés → Dino</option>
                        <option value="dino-to-en">Dino → Inglés</option>
                    </select>
                </div>
                <div class="control-group">
                    <label for="dino-input">Texto a traducir</label>
                    <textarea id="dino-input" placeholder="Escribe aquí..."></textarea>
                </div>
                <div class="output-container"><span class="output-label">Resultado</span><div id="dino-output"></div></div>
            </div>
        `;

        const input = document.getElementById('dino-input');
        const mode = document.getElementById('dino-mode');
        const output = document.getElementById('dino-output');

        function update() {
            const text = input.value;
            if (mode.value === 'en-to-dino') {
                output.textContent = window.toDino(text);
            } else {
                output.textContent = window.toEnglish(text);
            }
        }

        input.addEventListener('input', update);
        mode.addEventListener('change', update);
    };
})();
