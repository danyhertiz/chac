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
  const savedTheme = localStorage.getItem('ds-theme') || 'modern';
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
      case 'mb': default: return size;
    }
  }

  function formatTime(seconds) {
    if (seconds < 60) {
      return Math.round(seconds) + ' s';
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return minutes + 'm ' + secs + 's';
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

    const elements = { item, barDiv, fillDiv, percentSpan, timeSpan, blocksDiv, blocks: [] };

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
        elements.timeSpan.textContent = formatTime(remaining);
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