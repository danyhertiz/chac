document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.binary-container');
    const columns = 13;

    for (let i = 0; i < columns; i++) {
        const column = document.createElement('div');
        column.className = 'binary-column';
        
        let binaryString = '';
        for (let j = 0; j < 40; j++) { // Create a long string of binary digits
            binaryString += Math.random() > 0.5 ? '1<br>' : '0<br>';
        }
        column.innerHTML = binaryString;

        container.appendChild(column);
    }
});
