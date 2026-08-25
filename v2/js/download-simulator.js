(() => {
    'use strict';

    const allowedThemes = ['modern', 'vista', 'mac2000'];
    const speeds = [
        { label: '56 Kbps', mbps: 56 / 8000 },
        { label: '1 Mbps', mbps: 1 / 8 },
        { label: '10 Mbps', mbps: 10 / 8 },
        { label: '50 Mbps', mbps: 50 / 8 },
        { label: '100 Mbps', mbps: 100 / 8 },
        { label: '1 Gbps', mbps: 1000 / 8 },
        { label: '10 Gbps', mbps: 10000 / 8 }
    ];

    const convertToMB = (size, unit) => ({
        kb: size / 1024,
        mb: size,
        gb: size * 1024,
        tb: size * 1024 * 1024
    }[unit] || size);

    const formatTime = (seconds) => {
        if (seconds < 60) return `${Math.round(seconds)} s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ${Math.round((seconds % 3600) / 60)} min`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} d ${Math.round((seconds % 86400) / 3600)} h`;
        if (seconds < 2592000) return `${Math.floor(seconds / 604800)} sem ${Math.round((seconds % 604800) / 86400)} d`;
        if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} mes ${Math.round((seconds % 2592000) / 604800)} sem`;
        return `${Math.floor(seconds / 31536000)} a ${Math.round((seconds % 31536000) / 2592000)} mes`;
    };

    const buildBlocks = (elements) => {
        const count = Math.max(1, Math.floor((elements.barDiv.clientWidth + 2) / 8));
        elements.blocksDiv.replaceChildren();
        elements.blocks = [];

        for (let index = 0; index < count; index += 1) {
            const block = document.createElement('div');
            block.className = 'ds-block';
            elements.blocksDiv.appendChild(block);
            elements.blocks.push(block);
        }
    };

    const createDownloadItem = (speed) => {
        const item = document.createElement('div');
        item.className = 'ds-item';
        item.innerHTML = `
            <div class="ds-meta">
                <span class="ds-speed">${speed.label}</span>
                <span class="ds-percent">0%</span>
                <span class="ds-time">--</span>
            </div>
            <div class="ds-bar">
                <div class="ds-fill"></div>
                <div class="ds-blocks"></div>
            </div>`;

        return {
            item,
            barDiv: item.querySelector('.ds-bar'),
            fillDiv: item.querySelector('.ds-fill'),
            blocksDiv: item.querySelector('.ds-blocks'),
            percentSpan: item.querySelector('.ds-percent'),
            timeSpan: item.querySelector('.ds-time'),
            blocks: [],
            funMessage: null
        };
    };

    window.initDownloadSimulator = () => {
        const simulator = document.getElementById('download-simulator');
        if (!simulator || simulator.dataset.initialized === 'true') return;

        const sizeInput = simulator.querySelector('#ds-size');
        const unitSelect = simulator.querySelector('#ds-unit');
        const startButton = simulator.querySelector('#ds-start');
        const listDiv = simulator.querySelector('#ds-list');
        const themeSelect = simulator.querySelector('#ds-theme');
        let animations = [];

        let savedTheme = localStorage.getItem('ds-theme') || 'vista';
        if (!allowedThemes.includes(savedTheme)) savedTheme = 'vista';
        simulator.dataset.theme = savedTheme;
        themeSelect.value = savedTheme;
        simulator.dataset.initialized = 'true';

        themeSelect.addEventListener('change', () => {
            simulator.dataset.theme = themeSelect.value;
            localStorage.setItem('ds-theme', themeSelect.value);
        });

        const animateDownload = (speed, fileSizeMB, elements) => {
            const totalTime = fileSizeMB / speed.mbps;
            const startTime = performance.now();

            const update = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                const progress = Math.min(elapsed / totalTime, 1);
                const percent = Math.round(progress * 100);
                elements.fillDiv.style.width = `${percent}%`;
                elements.percentSpan.textContent = `${percent}%`;
                elements.timeSpan.textContent = progress < 1 ? formatTime(totalTime - elapsed) : 'Completado';

                if (progress < 1) {
                    const animationId = requestAnimationFrame(update);
                    animations.push(animationId);
                }
            };

            update();
        };

        startButton.addEventListener('click', () => {
            animations.forEach((animationId) => cancelAnimationFrame(animationId));
            animations = [];
            listDiv.replaceChildren();
            const size = Math.max(0, Number.parseFloat(sizeInput.value) || 0);
            const fileSizeMB = convertToMB(size, unitSelect.value);

            speeds.forEach((speed) => {
                const elements = createDownloadItem(speed);
                elements.item._dsElements = elements;
                listDiv.appendChild(elements.item);
                requestAnimationFrame(() => buildBlocks(elements));
                animateDownload(speed, fileSizeMB, elements);
            });
        });

        window.addEventListener('resize', () => {
            simulator.querySelectorAll('.ds-item').forEach((item) => {
                if (item._dsElements) requestAnimationFrame(() => buildBlocks(item._dsElements));
            });
        });
    };
})();
