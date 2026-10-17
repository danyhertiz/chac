window.initSnakeGame = function() {
      const root = document.getElementById('snake-game-root');
      if (!root || root.dataset.initialized === 'true') return;
      root.dataset.initialized = 'true';
      (function() {
      // ---------- CONFIGURACIÓN ----------
      const canvas = root.querySelector('#gameCanvas');
      const ctx = canvas.getContext('2d');
      const scoreSpan = root.querySelector('#scoreDisplay');
      const scoreBox = root.querySelector('#scoreBox');
      const levelSpan = root.querySelector('#levelDisplay');
      const livesSpan = root.querySelector('#livesDisplay');
      const pauseButton = root.querySelector('#pauseButton');
      const welcomeScreen = root.querySelector('#welcomeScreen');
      const startButton = root.querySelector('#startButton');

      const GRID_SIZE = 20;
      const CELL_SIZE = canvas.width / GRID_SIZE;

      const DIRS = {
        up:    { x: 0, y: -1 },
        down:  { x: 0, y: 1 },
        left:  { x: -1, y: 0 },
        right: { x: 1, y: 0 }
      };

      // ---------- SISTEMA DE NIVELES ----------
      const MAX_LEVEL = 10;
      const APPLES_PER_LEVEL = 10;
      const BASE_SPEED = 260;
      const SPEED_STEP = 20;

      // ---------- FRUTAS POR NIVEL ----------
      const FRUITS = [
        { name: 'Manzana', emoji: '🍎', draw: drawApple },
        { name: 'Plátano', emoji: '🍌', draw: drawBanana },
        { name: 'Cereza',  emoji: '🍒', draw: drawCherry },
        { name: 'Uva',     emoji: '🍇', draw: drawGrapes },
        { name: 'Naranja', emoji: '🍊', draw: drawOrange },
        { name: 'Fresa',   emoji: '🍓', draw: drawStrawberry },
        { name: 'Piña',    emoji: '🍍', draw: drawPineapple },
        { name: 'Sandía',  emoji: '🍉', draw: drawWatermelon },
        { name: 'Limón',   emoji: '🍋', draw: drawLemon },
        { name: 'Melón',   emoji: '🍈', draw: drawMelon }
      ];

      // ---------- ESTADO DEL JUEGO ----------
      let snake = [];
      let food = { x: 0, y: 0 };
      let direction = 'right';
      let nextDirection = 'right';
      let applesEaten = 0;
      let totalScore = 0;
      let level = 1;
      let lives = 3;
      let gameOver = false;
      let gameCompleted = false;
      let paused = false;
      let levelTransition = false;
      let gameStarted = false;      // controla si ya se inició desde la bienvenida
      let gameInterval = null;
      let directionChangedThisTick = false;

      // ---------- FUEGOS ARTIFICIALES ----------
      let fireworks = [];
      let fireworksAnimationId = null;
      let lastFireworkTime = 0;
      let celebrationActive = false;

      // ---------- UTILIDADES ----------
      function currentFruit() {
        return FRUITS[Math.min(level - 1, FRUITS.length - 1)];
      }

      function growthPerFruit() {
        return Math.min(level, 5);
      }

      function speedForLevel(lvl) {
        return Math.max(60, BASE_SPEED - (lvl - 1) * SPEED_STEP);
      }

      function updateHUD() {
        const fruit = currentFruit();
        scoreBox.childNodes[0].nodeValue = fruit.emoji + ' ';
        scoreSpan.textContent = applesEaten;
        levelSpan.textContent = level;
        livesSpan.textContent = lives;
      }

      function updatePauseButton() {
        if (paused) {
          pauseButton.textContent = '▶';
          pauseButton.classList.add('paused');
        } else {
          pauseButton.textContent = '⏸';
          pauseButton.classList.remove('paused');
        }
      }

      // ---------- PREPARAR ESTADO INICIAL (sin arrancar) ----------
      function prepareInitialState() {
        stopInterval();
        stopFireworks();
        clearScreenMessage();

        paused = false;
        levelTransition = false;
        gameOver = false;
        gameCompleted = false;
        updatePauseButton();

        snake = [
          { x: 9, y: 10 },
          { x: 8, y: 10 },
          { x: 7, y: 10 }
        ];

        direction = 'right';
        nextDirection = 'right';
        directionChangedThisTick = false;
        applesEaten = 0;
        totalScore = 0;
        level = 1;
        lives = 3;

        updateHUD();
        generateFood();
        drawGame();
      }

      // ---------- INICIAR JUEGO DESDE BIENVENIDA ----------
      function startGameFromWelcome() {
        if (gameStarted) return;
        gameStarted = true;
        welcomeScreen.classList.add('hidden');
        prepareInitialState();
        startInterval();
      }

      // ---------- REINICIO COMPLETO (botón ↻ o R) ----------
      function restartGame() {
        // Si aún no ha empezado, no hacemos nada especial (la bienvenida sigue visible)
        if (!gameStarted) return;

        stopInterval();
        stopFireworks();
        clearScreenMessage();

        // Ocultar bienvenida (por si acaso) y reiniciar estado
        welcomeScreen.classList.add('hidden');
        gameStarted = true;

        paused = false;
        levelTransition = false;
        gameOver = false;
        gameCompleted = false;
        updatePauseButton();

        snake = [
          { x: 9, y: 10 },
          { x: 8, y: 10 },
          { x: 7, y: 10 }
        ];

        direction = 'right';
        nextDirection = 'right';
        directionChangedThisTick = false;
        applesEaten = 0;
        totalScore = 0;
        level = 1;
        lives = 3;

        updateHUD();
        generateFood();
        drawGame();
        startInterval();
      }

      function resetLevelPosition() {
        snake = [
          { x: 9, y: 10 },
          { x: 8, y: 10 },
          { x: 7, y: 10 }
        ];
        direction = 'right';
        nextDirection = 'right';
        directionChangedThisTick = false;
        generateFood();
      }

      function startInterval() {
        stopInterval();
        if (paused || gameOver || gameCompleted || levelTransition || !gameStarted) return;
        const speed = speedForLevel(level);
        gameInterval = setInterval(gameTick, speed);
      }

      function stopInterval() {
        if (gameInterval) {
          clearInterval(gameInterval);
          gameInterval = null;
        }
      }

      // ---------- GENERAR COMIDA ----------
      function generateFood() {
        if (snake.length >= GRID_SIZE * GRID_SIZE) {
          completeLevel();
          return;
        }

        let found = false;
        let attempts = 0;
        while (!found && attempts < 3000) {
          const fx = Math.floor(Math.random() * GRID_SIZE);
          const fy = Math.floor(Math.random() * GRID_SIZE);
          if (!snake.some(seg => seg.x === fx && seg.y === fy)) {
            food = { x: fx, y: fy };
            found = true;
          }
          attempts++;
        }

        if (!found) {
          for (let y = 0; y < GRID_SIZE && !found; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
              if (!snake.some(seg => seg.x === x && seg.y === y)) {
                food = { x, y };
                found = true;
                break;
              }
            }
          }
        }
      }

      // ---------- TICK PRINCIPAL ----------
      function gameTick() {
        if (gameOver || gameCompleted || paused || levelTransition || !gameStarted) return;

        direction = nextDirection;
        directionChangedThisTick = false;

        const head = snake[0];
        const move = DIRS[direction];
        const newHead = { x: head.x + move.x, y: head.y + move.y };

        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
          loseLife();
          return;
        }

        const isEating = (newHead.x === food.x && newHead.y === food.y);

        let newSnake;
        if (isEating) {
          newSnake = [newHead, ...snake];
          const extra = growthPerFruit() - 1;
          for (let i = 0; i < extra; i++) {
            newSnake.push({ ...snake[snake.length - 1] });
          }
        } else {
          newSnake = [newHead, ...snake.slice(0, -1)];
        }

        const bodySegments = newSnake.slice(1);
        const selfCollision = bodySegments.some(seg => seg.x === newHead.x && seg.y === newHead.y);
        if (selfCollision) {
          loseLife();
          return;
        }

        snake = newSnake;

        if (isEating) {
          applesEaten++;
          totalScore++;
          updateHUD();

          if (applesEaten >= APPLES_PER_LEVEL) {
            completeLevel();
            return;
          }

          generateFood();
          if (gameCompleted) return;
        }

        drawGame();
      }

      // ---------- PERDER UNA VIDA ----------
      function loseLife() {
        stopInterval();
        lives--;
        updateHUD();

        if (lives <= 0) {
          endGame();
          return;
        }

        statusMessageScreen(
          `💔 ¡Perdiste una vida!`,
          `Te quedan ${lives} ${lives === 1 ? 'vida' : 'vidas'}`,
          '#ff8a8a'
        );

        resetLevelPosition();
        drawGame();

        levelTransition = true;

        setTimeout(() => {
          if (!gameOver && !gameCompleted && !paused && gameStarted) {
            levelTransition = false;
            clearScreenMessage();
            drawGame();
            startInterval();
          }
        }, 1800);
      }

      // ---------- COMPLETAR NIVEL ----------
      function completeLevel() {
        stopInterval();
        levelTransition = true;

        if (level >= MAX_LEVEL) {
          finishGame();
          return;
        }

        level++;
        applesEaten = 0;
        lives++;
        updateHUD();

        const fruit = currentFruit();
        statusMessageScreen(
          `⬆️ ¡NIVEL ${level}!`,
          `${fruit.emoji} ${fruit.name} · +1 vida`,
          '#ffe28a'
        );
        drawGame();

        setTimeout(() => {
          if (!gameOver && !gameCompleted && !paused && gameStarted) {
            snake = [
              { x: 9, y: 10 },
              { x: 8, y: 10 },
              { x: 7, y: 10 }
            ];
            direction = 'right';
            nextDirection = 'right';
            directionChangedThisTick = false;
            generateFood();
            levelTransition = false;
            clearScreenMessage();
            drawGame();
            startInterval();
          }
        }, 2200);
      }

      // ---------- GAME OVER ----------
      function endGame() {
        if (gameOver) return;
        gameOver = true;
        stopInterval();
        statusMessageScreen(
          '💀 GAME OVER 💀',
          'Sin vidas restantes',
          '#ff7b7b'
        );
        drawGame();
      }

      // ---------- FIN DEL JUEGO ----------
      function finishGame() {
        gameCompleted = true;
        gameOver = true;
        stopInterval();
        drawGame();
        startFireworks();
      }

      // ---------- CAMBIAR DIRECCIÓN ----------
      function changeDirection(newDir) {
        if (gameOver || gameCompleted || paused || levelTransition || !gameStarted) return;
        if (directionChangedThisTick) return;

        const isOpposite =
          (direction === 'up' && newDir === 'down') ||
          (direction === 'down' && newDir === 'up') ||
          (direction === 'left' && newDir === 'right') ||
          (direction === 'right' && newDir === 'left');

        if (isOpposite) return;
        if (direction === newDir) return;

        nextDirection = newDir;
        directionChangedThisTick = true;
      }

      // ---------- PAUSA ----------
      function togglePause() {
        if (!gameStarted) return;
        if (gameOver || gameCompleted) return;
        if (levelTransition) return;

        paused = !paused;
        updatePauseButton();

        if (paused) {
          stopInterval();
          drawGame();
          drawPauseOverlay();
        } else {
          startInterval();
          drawGame();
        }
      }

      function drawPauseOverlay() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 44px "Segoe UI", monospace';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ffe9a0';
        ctx.fillText('⏸ PAUSA', canvas.width/2, canvas.height/2 - 25);
        ctx.font = 'bold 20px "Segoe UI", monospace';
        ctx.fillStyle = '#d0e8c0';
        ctx.fillText('Pulsa P, Enter o ▶ para continuar', canvas.width/2, canvas.height/2 + 40);
        ctx.shadowBlur = 0;
      }

      // ---------- MENSAJE GRANDE CENTRAL ----------
      let screenMessage = null;

      function statusMessageScreen(title, subtitle, color) {
        screenMessage = { title, subtitle, color: color || '#ffe28a' };
      }

      function clearScreenMessage() {
        screenMessage = null;
      }

      // ---------- DIBUJAR JUEGO ----------
      function drawGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fondo
        ctx.fillStyle = '#1c2a1c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Cuadrícula
        ctx.strokeStyle = '#2e402e';
        ctx.lineWidth = 0.6;
        for (let i = 0; i <= GRID_SIZE; i++) {
          const pos = i * CELL_SIZE;
          ctx.beginPath();
          ctx.moveTo(pos, 0);
          ctx.lineTo(pos, canvas.height);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, pos);
          ctx.lineTo(canvas.width, pos);
          ctx.stroke();
        }

        // Comida
        if (food && !gameCompleted) {
          const fx = food.x * CELL_SIZE;
          const fy = food.y * CELL_SIZE;
          const cx = fx + CELL_SIZE / 2;
          const cy = fy + CELL_SIZE / 2;
          const radius = CELL_SIZE / 2 - 2;
          const fruit = currentFruit();
          ctx.save();
          ctx.shadowColor = 'rgba(255,220,130,0.9)';
          ctx.shadowBlur = 14;
          fruit.draw(ctx, cx, cy, radius);
          ctx.restore();
        }

        // Serpiente
        if (snake.length > 0) {
          for (let i = 0; i < snake.length; i++) {
            const seg = snake[i];
            const x = seg.x * CELL_SIZE;
            const y = seg.y * CELL_SIZE;

            if (i === 0) {
              ctx.shadowColor = '#b8ffb0';
              ctx.shadowBlur = 12;
              ctx.fillStyle = '#6ab04c';
              ctx.beginPath();
              ctx.roundRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 8);
              ctx.fill();
              ctx.shadowBlur = 0;
              ctx.fillStyle = '#f1f2f6';
              ctx.beginPath();
              ctx.arc(x + CELL_SIZE*0.35, y + CELL_SIZE*0.4, CELL_SIZE*0.12, 0, Math.PI*2);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(x + CELL_SIZE*0.65, y + CELL_SIZE*0.4, CELL_SIZE*0.12, 0, Math.PI*2);
              ctx.fill();
              ctx.fillStyle = '#1e272e';
              ctx.beginPath();
              ctx.arc(x + CELL_SIZE*0.33, y + CELL_SIZE*0.38, CELL_SIZE*0.06, 0, Math.PI*2);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(x + CELL_SIZE*0.63, y + CELL_SIZE*0.38, CELL_SIZE*0.06, 0, Math.PI*2);
              ctx.fill();
            } else {
              ctx.shadowColor = '#7bed9f';
              ctx.shadowBlur = 8;
              ctx.fillStyle = `rgb(80, 160, 80)`;
              ctx.beginPath();
              ctx.roundRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6, 6);
              ctx.fill();
              ctx.shadowBlur = 4;
              ctx.fillStyle = `rgb(120, 200, 120)`;
              ctx.beginPath();
              ctx.roundRect(x + 6, y + 6, CELL_SIZE - 12, CELL_SIZE - 12, 4);
              ctx.fill();
            }
          }
        }
        ctx.shadowBlur = 0;

        // Overlay pausa
        if (paused) {
          drawPauseOverlay();
        }

        // Overlay game over
        if (gameOver && !gameCompleted && !paused && !screenMessage) {
          drawDarkOverlay();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 42px "Segoe UI", monospace';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 14;
          ctx.fillStyle = '#ff7b7b';
          ctx.fillText('💀 GAME OVER 💀', canvas.width/2, canvas.height/2 - 20);
          ctx.font = 'bold 20px "Segoe UI", monospace';
          ctx.fillStyle = '#ffd0d0';
          ctx.fillText('Pulsa ↻ o R para reiniciar', canvas.width/2, canvas.height/2 + 45);
          ctx.shadowBlur = 0;
        }

        // Mensaje central grande
        if (screenMessage && !paused && !gameCompleted && gameStarted) {
          drawScreenMessage();
        }
      }

      function drawDarkOverlay() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      function drawScreenMessage() {
        const { title, subtitle, color } = screenMessage;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const maxTitleFontSize = 64;
        const maxTitleWidth = canvas.width * 0.86;
        ctx.font = `bold ${maxTitleFontSize}px "Segoe UI", monospace`;
        const titleWidth = ctx.measureText(title).width;
        const titleFontSize = Math.min(maxTitleFontSize, maxTitleFontSize * maxTitleWidth / titleWidth);
        ctx.font = `bold ${titleFontSize}px "Segoe UI", monospace`;
        ctx.shadowColor = color;
        ctx.shadowBlur = 30;
        ctx.fillStyle = color;
        ctx.fillText(title, canvas.width/2, canvas.height/2 - 55);

        ctx.shadowBlur = 12;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.2, canvas.height/2 + 5);
        ctx.lineTo(canvas.width * 0.8, canvas.height/2 + 5);
        ctx.stroke();

        ctx.font = 'bold 28px "Segoe UI", monospace';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(subtitle, canvas.width/2, canvas.height/2 + 65);

        ctx.shadowBlur = 0;
      }

      // ================================================================
      // DIBUJO DE FRUTAS (igual que antes)
      // ================================================================
      function drawApple(ctx, cx, cy, r) {
        ctx.fillStyle = '#e84118';
        ctx.beginPath();
        ctx.arc(cx, cy + r*0.1, r*0.9, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#ff6b4a';
        ctx.beginPath();
        ctx.arc(cx - r*0.3, cy - r*0.1, r*0.28, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#6b3f1f';
        ctx.lineWidth = Math.max(1.5, r*0.12);
        ctx.beginPath();
        ctx.moveTo(cx, cy - r*0.7);
        ctx.lineTo(cx + r*0.1, cy - r*1.1);
        ctx.stroke();
        ctx.fillStyle = '#7bed9f';
        ctx.beginPath();
        ctx.ellipse(cx + r*0.35, cy - r*0.85, r*0.3, r*0.18, 0.4, 0, Math.PI*2);
        ctx.fill();
      }

      function drawBanana(ctx, cx, cy, r) {
        ctx.strokeStyle = '#f7d51d';
        ctx.lineWidth = r*0.55;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx - r*0.1, cy + r*0.1, r*0.7, Math.PI*0.15, Math.PI*0.95);
        ctx.stroke();
        ctx.strokeStyle = '#fff3a0';
        ctx.lineWidth = r*0.15;
        ctx.beginPath();
        ctx.arc(cx - r*0.15, cy + r*0.05, r*0.62, Math.PI*0.25, Math.PI*0.75);
        ctx.stroke();
        ctx.fillStyle = '#5c3b12';
        ctx.beginPath();
        ctx.arc(cx + r*0.55, cy + r*0.6, r*0.1, 0, Math.PI*2);
        ctx.fill();
      }

      function drawCherry(ctx, cx, cy, r) {
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(cx - r*0.35, cy + r*0.25, r*0.5, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + r*0.35, cy + r*0.2, r*0.5, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#ff7a7a';
        ctx.beginPath();
        ctx.arc(cx - r*0.5, cy + r*0.1, r*0.15, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + r*0.2, cy + r*0.05, r*0.15, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#2e8b57';
        ctx.lineWidth = Math.max(1.5, r*0.1);
        ctx.beginPath();
        ctx.moveTo(cx - r*0.35, cy + r*0.15);
        ctx.quadraticCurveTo(cx - r*0.1, cy - r*0.6, cx + r*0.2, cy - r*0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + r*0.35, cy + r*0.1);
        ctx.quadraticCurveTo(cx + r*0.4, cy - r*0.5, cx + r*0.2, cy - r*0.8);
        ctx.stroke();
      }

      function drawGrapes(ctx, cx, cy, r) {
        ctx.fillStyle = '#8e44ad';
        const offsets = [
          [-0.35, -0.2], [0.35, -0.2], [0, -0.45],
          [-0.25, 0.1], [0.25, 0.1], [0, 0.35],
          [-0.1, 0.55], [0.1, 0.55], [0, -0.05]
        ];
        for (const [ox, oy] of offsets) {
          ctx.beginPath();
          ctx.arc(cx + ox*r, cy + oy*r, r*0.28, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.fillStyle = '#c39bd3';
        ctx.beginPath();
        ctx.arc(cx - r*0.35, cy - r*0.25, r*0.1, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#6b3f1f';
        ctx.lineWidth = Math.max(1.5, r*0.1);
        ctx.beginPath();
        ctx.moveTo(cx, cy - r*0.5);
        ctx.lineTo(cx, cy - r*0.9);
        ctx.stroke();
      }

      function drawOrange(ctx, cx, cy, r) {
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(cx, cy, r*0.9, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#ffc971';
        ctx.beginPath();
        ctx.arc(cx - r*0.3, cy - r*0.3, r*0.3, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.ellipse(cx + r*0.2, cy - r*0.8, r*0.3, r*0.15, 0.3, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,200,80,0.5)';
        ctx.beginPath();
        ctx.arc(cx + r*0.3, cy + r*0.2, r*0.06, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx - r*0.1, cy + r*0.4, r*0.06, 0, Math.PI*2);
        ctx.fill();
      }

      function drawStrawberry(ctx, cx, cy, r) {
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(cx, cy + r*0.9);
        ctx.quadraticCurveTo(cx - r*0.9, cy + r*0.2, cx - r*0.7, cy - r*0.4);
        ctx.quadraticCurveTo(cx, cy - r*0.9, cx + r*0.7, cy - r*0.4);
        ctx.quadraticCurveTo(cx + r*0.9, cy + r*0.2, cx, cy + r*0.9);
        ctx.fill();
        ctx.fillStyle = '#f9e79f';
        const seeds = [[-0.3, 0.1], [0.3, 0.1], [0, 0.35], [-0.4, -0.2], [0.4, -0.2], [0, -0.1], [-0.15, 0.55], [0.15, 0.55]];
        for (const [ox, oy] of seeds) {
          ctx.beginPath();
          ctx.arc(cx + ox*r, cy + oy*r, r*0.06, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.fillStyle = '#27ae60';
        for (let i = 0; i < 5; i++) {
          const angle = -Math.PI/2 + (i - 2) * 0.5;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(angle)*r*0.5, cy - r*0.55 + Math.sin(angle)*r*0.2, r*0.3, r*0.12, angle, 0, Math.PI*2);
          ctx.fill();
        }
      }

      function drawPineapple(ctx, cx, cy, r) {
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.ellipse(cx, cy + r*0.1, r*0.7, r*0.85, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = Math.max(1, r*0.06);
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i*r*0.25, cy - r*0.6);
          ctx.lineTo(cx + i*r*0.15, cy + r*0.85);
          ctx.stroke();
        }
        for (let j = -1; j <= 2; j++) {
          ctx.beginPath();
          ctx.moveTo(cx - r*0.6, cy + j*r*0.35);
          ctx.lineTo(cx + r*0.6, cy + j*r*0.25);
          ctx.stroke();
        }
        ctx.fillStyle = '#2ecc71';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.ellipse(cx + i*r*0.2, cy - r*0.95, r*0.12, r*0.4, i*0.15, 0, Math.PI*2);
          ctx.fill();
        }
      }

      function drawWatermelon(ctx, cx, cy, r) {
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.arc(cx, cy + r*0.3, r*0.85, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(cx, cy + r*0.3, r*0.7, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#2c3e50';
        const seeds = [[-0.3, -0.2], [0.3, -0.2], [0, -0.45], [-0.5, -0.05], [0.5, -0.05], [-0.15, -0.55], [0.15, -0.55]];
        for (const [ox, oy] of seeds) {
          ctx.beginPath();
          ctx.ellipse(cx + ox*r, cy + r*0.3 + oy*r, r*0.07, r*0.11, 0, 0, Math.PI*2);
          ctx.fill();
        }
      }

      function drawLemon(ctx, cx, cy, r) {
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.ellipse(cx, cy, r*0.85, r*0.7, 0.3, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - r*0.75, cy + r*0.25, r*0.18, r*0.12, 0.3, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + r*0.75, cy - r*0.25, r*0.18, r*0.12, 0.3, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff59d';
        ctx.beginPath();
        ctx.ellipse(cx - r*0.25, cy - r*0.25, r*0.3, r*0.18, 0.4, 0, Math.PI*2);
        ctx.fill();
      }

      function drawMelon(ctx, cx, cy, r) {
        ctx.fillStyle = '#a2d149';
        ctx.beginPath();
        ctx.arc(cx, cy, r*0.9, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#7fa838';
        ctx.lineWidth = Math.max(1, r*0.08);
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(cx, cy, r*0.85, Math.PI*0.2 + i*0.2, Math.PI*0.8 + i*0.2);
          ctx.stroke();
        }
        ctx.fillStyle = '#d4ed8c';
        ctx.beginPath();
        ctx.arc(cx - r*0.3, cy - r*0.3, r*0.25, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#5c3b12';
        ctx.lineWidth = Math.max(1.5, r*0.1);
        ctx.beginPath();
        ctx.moveTo(cx, cy - r*0.85);
        ctx.lineTo(cx, cy - r*1.05);
        ctx.stroke();
      }

      // ================================================================
      // FUEGOS ARTIFICIALES
      // ================================================================
      function startFireworks() {
        stopFireworks();
        fireworks = [];
        celebrationActive = true;
        lastFireworkTime = 0;

        function loop(now) {
          if (!celebrationActive) return;

          if (now - lastFireworkTime > 350) {
            spawnFirework();
            lastFireworkTime = now;
          }

          for (let i = fireworks.length - 1; i >= 0; i--) {
            const p = fireworks[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.06;
            p.vx *= 0.985;
            p.vy *= 0.985;
            p.life -= 0.012;
            p.radius *= 0.992;
            if (p.life <= 0) fireworks.splice(i, 1);
          }

          drawGame();

          for (const p of fireworks) {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;

          drawCompletionOverlay();

          fireworksAnimationId = requestAnimationFrame(loop);
        }

        fireworksAnimationId = requestAnimationFrame(loop);
      }

      function stopFireworks() {
        celebrationActive = false;
        if (fireworksAnimationId) {
          cancelAnimationFrame(fireworksAnimationId);
          fireworksAnimationId = null;
        }
        fireworks = [];
      }

      function spawnFirework() {
        const centerX = canvas.width * (0.15 + Math.random() * 0.7);
        const centerY = canvas.height * (0.15 + Math.random() * 0.5);
        const hue = Math.floor(Math.random() * 360);
        const count = 40 + Math.floor(Math.random() * 35);
        const speed = 2 + Math.random() * 2.5;

        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
          const s = speed * (0.5 + Math.random() * 0.8);
          fireworks.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * s,
            vy: Math.sin(angle) * s,
            life: 0.85 + Math.random() * 0.4,
            color: `hsl(${hue + Math.random() * 60 - 30}, 100%, ${55 + Math.random() * 25}%)`,
            radius: 1.8 + Math.random() * 2.2
          });
        }
      }

      function drawCompletionOverlay() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = 'bold 40px "Segoe UI", monospace';
        ctx.shadowColor = '#f7e05e';
        ctx.shadowBlur = 25;
        ctx.fillStyle = '#ffe95e';
        ctx.fillText('¡FELICIDADES!', canvas.width/2, canvas.height/2 - 45);

        ctx.font = 'bold 22px "Segoe UI", monospace';
        ctx.shadowColor = '#fff7b0';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Completaste los 10 niveles', canvas.width/2, canvas.height/2 + 15);

        ctx.font = 'bold 18px "Segoe UI", monospace';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#d0ffb0';
        ctx.fillText('🏆 Eres una leyenda de Snake 🏆', canvas.width/2, canvas.height/2 + 60);

        ctx.shadowBlur = 0;
      }

      // Helper roundRect
      CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        return this;
      };

      // ---------- EVENTOS DE TECLADO ----------
      function handleKeydown(e) {
        const key = e.key;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(key)) {
          e.preventDefault();
        }

        // Si la bienvenida está visible: Enter o Espacio inicia el juego
        if (!gameStarted) {
          if (key === 'Enter' || key === ' ') {
            startGameFromWelcome();
          }
          return;
        }

        switch (key) {
          case 'ArrowUp':    changeDirection('up'); break;
          case 'ArrowDown':  changeDirection('down'); break;
          case 'ArrowLeft':  changeDirection('left'); break;
          case 'ArrowRight': changeDirection('right'); break;
          case 'p':
          case 'P':
          case 'Enter':
            togglePause();
            break;
          case 'r':
          case 'R':
            restartGame();
            break;
          default: return;
        }
      }

      // ---------- BOTONES TÁCTILES DE DIRECCIÓN ----------
      function setupDirectionalButtons() {
        const buttons = root.querySelectorAll('.dpad-btn');
        buttons.forEach(btn => {
          const dir = btn.getAttribute('data-dir');
          // touchstart para respuesta inmediata en móvil, click para PC
          btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!gameStarted) return;
            changeDirection(dir);
          }, { passive: false });
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!gameStarted) return;
            changeDirection(dir);
          });
        });
      }

      // ---------- INICIALIZAR ----------
      // Estado inicial (canvas listo, sin arrancar)
      prepareInitialState();
      updatePauseButton();

      // Botón de inicio de bienvenida
      startButton.addEventListener('click', (e) => {
        e.preventDefault();
        startGameFromWelcome();
      });

      // Botones del header
      root.querySelector('#restartButton').addEventListener('click', (e) => {
        e.preventDefault();
        restartGame();
      });
      pauseButton.addEventListener('click', (e) => {
        e.preventDefault();
        togglePause();
      });

      setupDirectionalButtons();
      window.addEventListener('keydown', handleKeydown);

      const handleBeforeUnload = () => {
        stopInterval();
        stopFireworks();
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.destroySnakeGame = () => {
        gameStarted = false;
        stopInterval();
        stopFireworks();
        window.removeEventListener('keydown', handleKeydown);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        root.dataset.initialized = 'false';
      };

    })();
};