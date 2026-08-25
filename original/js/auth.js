
(function() {
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        const isGitHubPages = window.location.hostname === 'danyhertiz.github.io';
        const indexPath = isGitHubPages ? '/chac/index.html' : 'index.html';
        window.location.href = indexPath;
    }
})();
