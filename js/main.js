// Esperar a que el DOM esté listo y a que el header se haya inyectado
const initializeModeSwitch = () => {
    const switchBtn = document.getElementById('modeSwitch');
    
    if (!switchBtn) {
        // Reintentar en 100ms si el header aún no se ha inyectado
        setTimeout(initializeModeSwitch, 100);
        return;
    }

    const enableDarkMode = () => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('darkMode', 'enabled');
    };

    const disableDarkMode = () => {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('darkMode', 'disabled');
    };

    const toggleDarkMode = () => {
        if (localStorage.getItem('darkMode') !== 'enabled') {
            enableDarkMode();
        } else {
            disableDarkMode();
        }
    };

    // Agregar evento al switch
    switchBtn.addEventListener('click', toggleDarkMode);
    
    // Observar si el header se reinyecta dinámicamente (por si acaso)
    const observer = new MutationObserver(function(mutations) {
        const newModeSwitch = document.getElementById('modeSwitch');
        if (newModeSwitch && !newModeSwitch.hasListener) {
            newModeSwitch.addEventListener('click', toggleDarkMode);
            newModeSwitch.hasListener = true;
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
};

document.addEventListener('DOMContentLoaded', initializeModeSwitch);