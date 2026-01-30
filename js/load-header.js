// Inyectar header en todas las páginas
document.addEventListener('DOMContentLoaded', function() {
    // Buscar la ubicación donde debe ir el header
    // Si ya existe un header, no hacer nada
    if (document.querySelector('header')) {
        return;
    }
    
    // Si el contenido está protegido, el header debe ir dentro de protected-content
    const protectedContent = document.getElementById('protected-content');
    const insertionPoint = protectedContent || document.body;
    
    // Crear el header HTML
    const isGitHubPages = window.location.hostname === 'danyhertiz.github.io';
    const basePath = isGitHubPages ? '/chac/' : '';
    
    const headerHTML = `<header>
        <div class="header-main">
            <div class="binary-container"></div>
            <h1><a href="${basePath}index.html" style="text-decoration: none; color: inherit;">Dany Hertiz</a></h1>
            <nav class="main-nav">
                <ul class="nav-links" id="nav-links">
                    <li><a href="${basePath}historias.html">Historias</a></li>
                    <li><a href="${basePath}videos.html">Videos</a></li>
                </ul>
            </nav>
        </div>
    </header>`;
    
    // Inyectar el header al inicio del contenedor apropiado
    if (protectedContent) {
        protectedContent.insertAdjacentHTML('afterbegin', headerHTML);
    } else {
        insertionPoint.insertAdjacentHTML('afterbegin', headerHTML);
    }
    
    // Inicializar la animación del fondo binario DESPUÉS de inyectar el header
    initializeBinaryBackground();
});

// Función para inicializar el fondo binario
function initializeBinaryBackground() {
    // Limpiar cualquier contenido existente
    const containers = document.querySelectorAll('.binary-container');
    containers.forEach(container => {
        container.innerHTML = '';
    });

    // Inicializar el fondo binario solo en el primer contenedor
    const container = document.querySelector('.binary-container');
    if (!container) return;

    const columns = 13;
    const columnElements = [];

    for (let i = 0; i < columns; i++) {
        const column = document.createElement('div');
        column.className = 'binary-column';
        
        let binaryString = '';
        for (let j = 0; j < 40; j++) {
            binaryString += Math.random() > 0.5 ? '1<br>' : '0<br>';
        }
        column.innerHTML = binaryString;
        columnElements.push(column);
    }

    // Añadir todas las columnas de una vez
    container.append(...columnElements);
}
