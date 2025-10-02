document.addEventListener('DOMContentLoaded', () => {
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
});
