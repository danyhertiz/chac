// Cargar y renderizar un archivo Markdown desde /content/stories según ?post=
(() => {
    const params = new URLSearchParams(window.location.search);
    let post = params.get('post') || 'prueba.md';
    // Sanitizar: permitir solo nombre de archivo básico
    post = post.split('/').pop().replace(/[^a-zA-Z0-9_.-]/g, '');
    if (!/\.md$/i.test(post)) post += '.md';
    const basePath = '/content/stories/';
    const load = (filename) => {
        return fetch(basePath + filename).then(resp => {
            if (!resp.ok) throw new Error('Not found');
            return resp.text();
        });
    };
    load(post)
        .catch(() => {
            if (post !== 'prueba.md') return load('prueba.md');
            throw new Error('No se pudo cargar el markdown');
        })
        .then(text => {
            const html = marked.parse(text);
            const el = document.getElementById('content');
            if (el) el.innerHTML = html;
        })
        .catch(err => {
            console.error('Error cargando Markdown:', err);
        });
})();