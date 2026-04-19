(function() {
  'use strict';

  const simulator = document.getElementById('download-simulator');
  if (!simulator) return;

  const sizeInput = document.getElementById('ds-size');
  const unitSelect = document.getElementById('ds-unit');
  const startButton = document.getElementById('ds-start');
  const listDiv = document.getElementById('ds-list');
  const themeSelect = document.getElementById('ds-theme');

  // Load saved theme
  const allowedThemes = ['modern', 'vista', 'mac2000'];

  let savedTheme = localStorage.getItem('ds-theme') || 'modern';

  if (!allowedThemes.includes(savedTheme)) {
    savedTheme = 'modern';
  }

  simulator.setAttribute('data-theme', savedTheme);
  themeSelect.value = savedTheme;

  // Theme switcher
  themeSelect.addEventListener('change', () => {
    const selectedTheme = themeSelect.value;
    simulator.setAttribute('data-theme', selectedTheme);
    localStorage.setItem('ds-theme', selectedTheme);
  });

  // Speeds in MB/s: 56 Kbps, 1 Mbps, 10 Mbps, 50 Mbps, 100 Mbps, 1 Gbps, 10 Gbps
  const speeds = [
    { label: '56 Kbps', mbps: 56 / 8000 },
    { label: '1 Mbps', mbps: 1 / 8 },
    { label: '10 Mbps', mbps: 10 / 8 },
    { label: '50 Mbps', mbps: 50 / 8 },
    { label: '100 Mbps', mbps: 100 / 8 },
    { label: '1 Gbps', mbps: 1000 / 8 },
    { label: '10 Gbps', mbps: 10000 / 8 }
  ];

  let animations = [];

  function convertToMB(size, unit) {
    switch (unit) {
      case 'kb': return size / 1024;
      case 'gb': return size * 1024;
      case 'tb': return size * 1024 * 1024;
      case 'mb': default: return size;
    }
  }

  function formatTime(seconds) {
    if (seconds < 60) {
      return Math.round(seconds) + ' s';
    }
    if (seconds < 3600) { // < 1 hour
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return minutes + ' min ' + secs + ' s';
    }
    if (seconds < 86400) { // < 1 day
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.round((seconds % 3600) / 60);
      return hours + ' h ' + minutes + ' min';
    }
    if (seconds < 604800) { // < 1 week
      const days = Math.floor(seconds / 86400);
      const hours = Math.round((seconds % 86400) / 3600);
      return days + ' d ' + hours + ' h';
    }
    if (seconds < 2592000) { // < 1 month
      const weeks = Math.floor(seconds / 604800);
      const days = Math.round((seconds % 604800) / 86400);
      return weeks + ' sem ' + days + ' d';
    }
    if (seconds < 31536000) { // < 1 year
      const months = Math.floor(seconds / 2592000);
      const weeks = Math.round((seconds % 2592000) / 604800);
      return months + ' mes ' + weeks + ' sem';
    }
    // >= 1 year
    const years = Math.floor(seconds / 31536000);
    const months = Math.round((seconds % 31536000) / 2592000);
    return years + ' a ' + months + ' mes';
  }

  function buildBlocks(elements) {
    const barWidth = elements.barDiv.clientWidth;

    const blockWidth = 6;
    const gap = 2;
    const unit = blockWidth + gap;

    const count = Math.max(1, Math.floor((barWidth + gap) / unit));

    elements.blocksDiv.innerHTML = '';
    elements.blocks = [];

    for (let i = 0; i < count; i++) {
      const block = document.createElement('div');
      block.className = 'ds-block';
      elements.blocksDiv.appendChild(block);
      elements.blocks.push(block);
    }
  }

  function createDownloadItem(speed) {
    const item = document.createElement('div');
    item.className = 'ds-item';

    const metaDiv = document.createElement('div');
    metaDiv.className = 'ds-meta';

    const speedSpan = document.createElement('span');
    speedSpan.className = 'ds-speed';
    speedSpan.textContent = speed.label;
    metaDiv.appendChild(speedSpan);

    const percentSpan = document.createElement('span');
    percentSpan.className = 'ds-percent';
    percentSpan.textContent = '0%';
    metaDiv.appendChild(percentSpan);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'ds-time';
    timeSpan.textContent = '--';
    metaDiv.appendChild(timeSpan);

    item.appendChild(metaDiv);

    const barDiv = document.createElement('div');
    barDiv.className = 'ds-bar';

    // Always create both fill and blocks
    const fillDiv = document.createElement('div');
    fillDiv.className = 'ds-fill';
    fillDiv.style.width = '0%';
    barDiv.appendChild(fillDiv);

    const blocksDiv = document.createElement('div');
    blocksDiv.className = 'ds-blocks';
    barDiv.appendChild(blocksDiv);

    item.appendChild(barDiv);

    const elements = { item, barDiv, fillDiv, percentSpan, timeSpan, blocksDiv, blocks: [], funMessage: null };

    return elements;
  }

  function animateDownload(speed, fileSizeMB, elements) {
    const totalTime = fileSizeMB / speed.mbps;
    const startTime = performance.now();
    let animationId;

    function update() {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = Math.min(elapsed / totalTime, 1);
      const percent = Math.round(progress * 100);

      const theme = simulator.getAttribute('data-theme');

      // Always update fill (for non-block themes)
      elements.fillDiv.style.width = percent + '%';

      if (theme === 'win98' || theme === 'winxp') {
        const totalBlocks = elements.blocks.length;
        const activeBlocks = Math.floor(progress * totalBlocks);

        elements.blocks.forEach((block, i) => {
          block.classList.toggle('active', i < activeBlocks);
        });
      }

      elements.percentSpan.textContent = percent + '%';

      if (progress < 1) {
        const remaining = totalTime - elapsed;
        let text = formatTime(remaining);
        if (remaining >= 31536000) {
          if (!elements.funMessage) {
            const messages = [
              "😅 Paciencia...",
              "⏳ Esto va para largo...",
              "🚀 Tal vez quieras hacer otra cosa...",
              "😂 Mejor vuelve mañana..."
            ];
            elements.funMessage = messages[Math.floor(Math.random() * messages.length)];
          }
          text += " " + elements.funMessage;
        }
        elements.timeSpan.textContent = text;
        animationId = requestAnimationFrame(update);
      } else {
        elements.timeSpan.textContent = 'Completado';
      }
    }

    update();
    return animationId;
  }

  startButton.addEventListener('click', () => {
    // Reset previous animations
    animations.forEach(id => cancelAnimationFrame(id));
    animations = [];
    listDiv.innerHTML = '';

    const size = parseFloat(sizeInput.value);
    const unit = unitSelect.value;
    const fileSizeMB = convertToMB(size, unit);

    speeds.forEach(speed => {
      const elements = createDownloadItem(speed);
      listDiv.appendChild(elements.item);
      elements.item._dsElements = elements;
      requestAnimationFrame(() => {
        buildBlocks(elements);
      });
      const animationId = animateDownload(speed, fileSizeMB, elements);
      animations.push(animationId);
    });
  });

  window.addEventListener('resize', () => {
    document.querySelectorAll('.ds-item').forEach(item => {
      const elements = item._dsElements;
      if (!elements) return;
      requestAnimationFrame(() => {
        buildBlocks(elements);
      });
    });
  });
})();