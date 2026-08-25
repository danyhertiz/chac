const PASSWORD_HASH = 'c3f5d244d7a1bf2eeba9ad852009b15c63610fb3f452d1b5f59a59762274355f';

(() => {
    const isAuthenticated = () => sessionStorage.getItem('authenticated') === 'true';

    const showSite = () => {
        document.body.classList.add('auth-ready');
        document.getElementById('site-content')?.removeAttribute('hidden');
        document.getElementById('auth-screen')?.classList.add('is-hidden');
        window.authenticated = true;
        window.dispatchEvent(new Event('authenticated'));
    };

    const hashPassword = async (password) => {
        const encodedPassword = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encodedPassword);
        return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
    };

    const initializeAuthentication = () => {
        if (isAuthenticated()) {
            showSite();
            return;
        }

        const form = document.getElementById('auth-form');
        const passwordInput = document.getElementById('auth-password');
        const errorMessage = document.getElementById('auth-error');

        form?.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorMessage.textContent = '';

            if (await hashPassword(passwordInput.value) === PASSWORD_HASH) {
                sessionStorage.setItem('authenticated', 'true');
                showSite();
                return;
            }

            errorMessage.textContent = 'La contraseña no es correcta.';
            passwordInput.select();
        });

        passwordInput?.focus();
    };

    window.authenticated = isAuthenticated();
    if (window.authenticated) {
        document.documentElement.classList.add('auth-session');
    }
    document.addEventListener('DOMContentLoaded', initializeAuthentication, { once: true });
})();