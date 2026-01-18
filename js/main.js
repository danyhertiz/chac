document.addEventListener('DOMContentLoaded', () => {
    const switchBtn = document.getElementById('modeSwitch');

    const enableDarkMode = () => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('darkMode', 'enabled');
    };

    const disableDarkMode = () => {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('darkMode', 'disabled');
    };

    switchBtn.addEventListener('click', () => {
        if (localStorage.getItem('darkMode') !== 'enabled') {
            enableDarkMode();
        } else {
            disableDarkMode();
        }
    });
});