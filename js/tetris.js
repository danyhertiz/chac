window.initTetrisGame = () => {
      const gameRoot = document.getElementById('tetris-game');
      if (!gameRoot || gameRoot.dataset.initialized === 'true') return;
      gameRoot.dataset.initialized = 'true';

      // ----- CONFIGURACIÓN CLÁSICA -----
      const COLS = 10;
      const ROWS = 20;
      const BLOCK_SIZE = 30; // 300x600

      // Colores vibrantes estilo Tetris
      const COLORS = [
        null,           // 0 vacío
        '#00e5f0',      // I cian
        '#f7e476',      // O amarillo
        '#b484e0',      // T púrpura
        '#6fcf97',      // S verde
        '#eb5757',      // Z rojo
        '#5d9bdb',      // J azul
        '#f2994a'       // L naranja
      ];

      // Figuras (matrices)
      const SHAPES = [
        [], // 0
        // I
        [
          [0,0,0,0],
          [1,1,1,1],
          [0,0,0,0],
          [0,0,0,0]
        ],
        // O
        [
          [2,2],
          [2,2]
        ],
        // T
        [
          [0,3,0],
          [3,3,3],
          [0,0,0]
        ],
        // S
        [
          [0,4,4],
          [4,4,0],
          [0,0,0]
        ],
        // Z
        [
          [5,5,0],
          [0,5,5],
          [0,0,0]
        ],
        // J
        [
          [6,0,0],
          [6,6,6],
          [0,0,0]
        ],
        // L
        [
          [0,0,7],
          [7,7,7],
          [0,0,0]
        ]
      ];

      // ----- CANVAS PRINCIPAL -----
      const canvas = gameRoot.querySelector('#tetrisCanvas');
      const ctx = canvas.getContext('2d');
      // Ajuste de resolución interna (mantenemos 300x600 pero nítido)
      canvas.width = COLS * BLOCK_SIZE;   // 300
      canvas.height = ROWS * BLOCK_SIZE;  // 600

      // Canvas siguiente pieza
      const nextCanvas = gameRoot.querySelector('#nextCanvas');
      const nextCtx = nextCanvas.getContext('2d');
      nextCanvas.width = 120;
      nextCanvas.height = 120;
      const NEXT_CELL = 24; // 24px por celda, centrado

      // ----- ESTADO DEL JUEGO -----
      let board = [];
      let currentPiece = null; // { shape, x, y, type }
      let nextPieceType = 1;   // 1..7
      let score = 0;
      let gameOver = false;
      let gameInterval = null;
      const BASE_INTERVAL = 500; // ms

      // Elementos DOM
      const scoreDisplay = gameRoot.querySelector('#scoreDisplay');
      const restartBtn = gameRoot.querySelector('#restartButton');

      // ----- INICIALIZACIÓN DEL TABLERO -----
      function createEmptyBoard() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
      }

      // ----- GENERACIÓN DE PIEZAS -----
      function getRandomPieceType() {
        return Math.floor(Math.random() * 7) + 1; // 1..7
      }

      function createPieceFromType(type) {
        const shape = SHAPES[type].map(row => [...row]); // copia profunda
        return {
          shape,
          x: Math.floor((COLS - shape[0].length) / 2),
          y: 0,
          type
        };
      }

      // Coloca la nueva pieza actual y prepara la siguiente
      function spawnNewPiece() {
        if (!nextPieceType) nextPieceType = getRandomPieceType();
        currentPiece = createPieceFromType(nextPieceType);
        nextPieceType = getRandomPieceType();

        // Si la pieza colisiona nada más aparecer → fin del juego
        if (collision(currentPiece.shape, currentPiece.x, currentPiece.y)) {
          gameOver = true;
          clearInterval(gameInterval);
          gameInterval = null;
          currentPiece = null;
        }
        drawAll();
      }

      // ----- COLISIONES -----
      function collision(shape, offsetX, offsetY) {
        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[0].length; c++) {
            if (shape[r][c] !== 0) {
              const boardX = offsetX + c;
              const boardY = offsetY + r;
              if (boardX < 0 || boardX >= COLS || boardY >= ROWS || boardY < 0) {
                return true;
              }
              if (boardY >= 0 && board[boardY][boardX] !== 0) {
                return true;
              }
            }
          }
        }
        return false;
      }

      // ----- FIJAR PIEZA AL TABLERO -----
      function mergePiece() {
        if (!currentPiece) return;
        const { shape, x, y, type } = currentPiece;
        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[0].length; c++) {
            if (shape[r][c] !== 0) {
              const boardY = y + r;
              const boardX = x + c;
              if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
                board[boardY][boardX] = type;
              }
            }
          }
        }
        // Limpia líneas y actualiza puntaje
        clearFullRows();
        // Genera nueva pieza
        spawnNewPiece();
        drawAll();
      }

      // ----- LIMPIEZA DE LÍNEAS -----
      function clearFullRows() {
        let rowsCleared = 0;
        for (let row = ROWS - 1; row >= 0; ) {
          if (board[row].every(cell => cell !== 0)) {
            // Eliminar fila
            board.splice(row, 1);
            board.unshift(new Array(COLS).fill(0));
            rowsCleared++;
            // No incrementamos row, porque ahora hay una nueva fila en la misma posición
          } else {
            row--;
          }
        }
        if (rowsCleared > 0) {
          // Puntuación clásica: 1 línea=100, 2=300, 3=500, 4=800
          const points = [0, 100, 300, 500, 800];
          const addScore = points[rowsCleared] || 800;
          score += addScore;
          updateScoreUI();
        }
      }

      // ----- MOVIMIENTOS -----
      function movePiece(dx, dy) {
        if (!currentPiece || gameOver) return false;
        const { shape, x, y } = currentPiece;
        if (!collision(shape, x + dx, y + dy)) {
          currentPiece.x += dx;
          currentPiece.y += dy;
          drawAll();
          return true;
        } else if (dy === 1) { // intento de bajar y hay colisión → fijar
          mergePiece();
          drawAll();
        }
        return false;
      }

      function rotatePiece() {
        if (!currentPiece || gameOver) return;
        const oldShape = currentPiece.shape;
        // Rotación 90° horaria
        const rotated = oldShape[0].map((_, idx) => oldShape.map(row => row[idx]).reverse());
        // Patada de pared simple: intentar desplazar si colisiona
        if (!collision(rotated, currentPiece.x, currentPiece.y)) {
          currentPiece.shape = rotated;
        } else {
          // Intentar mover a la izquierda o derecha una posición
          if (!collision(rotated, currentPiece.x - 1, currentPiece.y)) {
            currentPiece.shape = rotated;
            currentPiece.x -= 1;
          } else if (!collision(rotated, currentPiece.x + 1, currentPiece.y)) {
            currentPiece.shape = rotated;
            currentPiece.x += 1;
          } // si no, no se rota
        }
        drawAll();
      }

      function hardDrop() {
        if (!currentPiece || gameOver) return;
        while (!collision(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
          currentPiece.y += 1;
        }
        mergePiece(); // fija la pieza y genera nueva
        drawAll();
      }

      // ----- DIBUJO PRINCIPAL -----
      function drawBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Fondo sutil con cuadrícula
        ctx.fillStyle = '#10131e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let row = 0; row < ROWS; row++) {
          for (let col = 0; col < COLS; col++) {
            const cell = board[row][col];
            if (cell !== 0) {
              drawBlock(ctx, col, row, COLORS[cell], BLOCK_SIZE);
            } else {
              // Dibuja cuadrícula tenue
              ctx.fillStyle = '#1a1f2e';
              ctx.fillRect(col * BLOCK_SIZE, row * BLOCK_SIZE, BLOCK_SIZE-0.8, BLOCK_SIZE-0.8);
            }
          }
        }
      }

      // Dibuja un bloque con estilo colorido y bisel
      function drawBlock(context, col, row, color, size) {
        const x = col * size;
        const y = row * size;
        // Relleno principal
        context.fillStyle = color;
        context.fillRect(x, y, size-1, size-1);
        // Brillo superior izquierdo
        context.fillStyle = 'rgba(255,255,255,0.25)';
        context.fillRect(x, y, size-4, 3);
        context.fillRect(x, y, 3, size-4);
        // Sombra inferior derecha
        context.fillStyle = 'rgba(0,0,0,0.3)';
        context.fillRect(x + size-4, y+2, 3, size-4);
        context.fillRect(x+2, y + size-4, size-4, 3);
        // Borde interior
        context.strokeStyle = 'rgba(0,0,0,0.5)';
        context.lineWidth = 1;
        context.strokeRect(x+1.5, y+1.5, size-3, size-3);
      }

      // Dibuja la pieza actual
      function drawCurrentPiece() {
        if (!currentPiece) return;
        const { shape, x, y, type } = currentPiece;
        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[0].length; c++) {
            if (shape[r][c] !== 0) {
              const boardX = x + c;
              const boardY = y + r;
              if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
                drawBlock(ctx, boardX, boardY, COLORS[type], BLOCK_SIZE);
              }
            }
          }
        }
      }

      // Dibuja la siguiente pieza en su canvas
      function drawNextPiece() {
        nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        nextCtx.fillStyle = '#10131e';
        nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
        
        const shape = SHAPES[nextPieceType];
        if (!shape || shape.length === 0) return;
        
        const shapeCols = shape[0].length;
        const shapeRows = shape.length;
        const offsetX = (nextCanvas.width - shapeCols * NEXT_CELL) / 2;
        const offsetY = (nextCanvas.height - shapeRows * NEXT_CELL) / 2;

        for (let r = 0; r < shapeRows; r++) {
          for (let c = 0; c < shapeCols; c++) {
            if (shape[r][c] !== 0) {
              const x = offsetX + c * NEXT_CELL;
              const y = offsetY + r * NEXT_CELL;
              // Dibujar bloque reducido
              nextCtx.fillStyle = COLORS[nextPieceType];
              nextCtx.fillRect(x, y, NEXT_CELL-1, NEXT_CELL-1);
              nextCtx.fillStyle = 'rgba(255,255,255,0.3)';
              nextCtx.fillRect(x, y, NEXT_CELL-6, 3);
              nextCtx.fillRect(x, y, 3, NEXT_CELL-6);
              nextCtx.fillStyle = 'rgba(0,0,0,0.3)';
              nextCtx.fillRect(x + NEXT_CELL-6, y+2, 3, NEXT_CELL-6);
              nextCtx.fillRect(x+2, y + NEXT_CELL-6, NEXT_CELL-6, 3);
            }
          }
        }
      }

      function drawAll() {
        drawBoard();
        drawCurrentPiece();
        drawNextPiece();
      }

      function updateScoreUI() {
        scoreDisplay.textContent = score;
      }

      // ----- BUCLE DE JUEGO -----
      function gameTick() {
        if (!gameOver && currentPiece) {
          movePiece(0, 1); // baja automáticamente
        }
      }

      function startGameLoop() {
        if (gameInterval) clearInterval(gameInterval);
        gameInterval = setInterval(gameTick, BASE_INTERVAL);
      }

      // ----- REINICIAR JUEGO -----
      function resetGame() {
        // Detener intervalo
        if (gameInterval) {
          clearInterval(gameInterval);
          gameInterval = null;
        }
        // Reiniciar estado
        board = createEmptyBoard();
        score = 0;
        updateScoreUI();
        gameOver = false;
        nextPieceType = getRandomPieceType();
        // Generar primera pieza
        spawnNewPiece(); // también actualiza nextPieceType y dibuja
        startGameLoop();
        drawAll();
      }

      // ----- CONTROLES DE TECLADO -----
      function handleKeyDown(e) {
        const key = e.key;
        // Evitar que las flechas y espacio hagan scroll
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Space"].includes(key)) {
          e.preventDefault();
        }
        if (gameOver) {
          if (key === ' ' || key === 'Space' || key === 'Enter') {
            resetGame();
          }
          return;
        }
        if (!currentPiece) return;

        switch (key) {
          case 'ArrowLeft':  movePiece(-1, 0); break;
          case 'ArrowRight': movePiece(1, 0); break;
          case 'ArrowDown':  movePiece(0, 1); break;
          case 'ArrowUp':    rotatePiece(); break;
          case ' ':
          case 'Space':      hardDrop(); break;
          default: return;
        }
        drawAll();
      }

      // ----- EVENTOS E INICIALIZACIÓN -----
      const handleRestart = () => {
        resetGame();
      };
      const handleResize = () => drawAll();

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', handleResize);
      restartBtn.addEventListener('click', handleRestart);

      window.destroyTetrisGame = () => {
        if (gameInterval) clearInterval(gameInterval);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('resize', handleResize);
        restartBtn.removeEventListener('click', handleRestart);
        gameRoot.dataset.initialized = 'false';
        window.destroyTetrisGame = null;
      };

      resetGame();
};
