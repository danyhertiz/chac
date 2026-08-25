# 🎨 Mejoras de Selección Automática de Posters

## 📋 Resumen de Cambios

Tu script de generación de películas ahora tiene capacidad de:

✅ Obtener **todos los posters disponibles** desde TMDb
✅ **Seleccionar automáticamente** el mejor poster según criterios inteligentes
✅ **Aplicar overrides manuales** para casos específicos
✅ **Mantener compatibilidad** con el sistema existente

---

## 🚀 Uso: Selección Automática (Defecto)

**Sin configuración adicional**, el script ahora:

1. **Fetch a `/movie/{id}/images`** - Obtiene todos los posters disponibles
2. **Prioriza por idioma:**
   - 🇪🇸 Posters en español (`iso_639_1 === "es"`)
   - 🎬 Posters sin idioma (`iso_639_1 === null`)
   - 🌍 Otros idiomas (como fallback)

3. **Ordena dentro de cada categoría:**
   - `vote_average` (descendente) - Puntuación de usuarios
   - `vote_count` (descendente) - Cantidad de votos
   - `width` (descendente) - Resolución

**Ejemplo de logs:**
```
🎨 Poster seleccionado (español): 7.8/10 (votos: 45)
⬇️ Descargando poster: 603.jpg
✅ Poster guardado: 603.jpg
```

---

## 🔧 Uso: Overrides Manuales

Para **películas específicas**, puedes usar posters personalizados sin descargar desde TMDb.

### 1. Editar `posterOverrides.json`

**Formato:**
```json
{
  "603": "posters/custom-matrix.jpg",
  "13246": "posters/custom-garfield.jpg"
}
```

### 2. Obtener IDs de TMDb

- Visita: https://www.themoviedb.org/
- Busca la película
- El ID está en la URL: `https://www.themoviedb.org/movie/{ID}`

**Ejemplo:**
```json
{
  "603": "/custom/matrix-poster.jpg",
  "_nota": "The Matrix - ID 603"
}
```

### 3. Usar tu propio poster

- Copia el archivo imagen a tu carpeta de posters
- Usa la ruta relativa en `posterOverrides.json`
- El script lo usará en lugar de descargar automáticamente

**Logs cuando se aplica override:**
```
📌 Poster override aplicado
```

---

## 📚 Arquitectura Interna

### Funciones Nuevas

#### `loadPosterOverrides()`
```javascript
// Carga y valida posterOverrides.json
const overrides = await loadPosterOverrides();
// Retorna: { "603": "/custom/path.jpg", ... }
```

#### `getMovieImages(movieId)`
```javascript
// Obtiene array de todos los posters disponibles
const posters = await getMovieImages(603);
// Retorna: [ { file_path: "/...", vote_average: 7.8, ... }, ... ]
```

#### `selectBestPoster(posters)`
```javascript
// Selecciona el mejor de la lista según criterios
const best = selectBestPoster(posters);
// Retorna: { file_path: "/...", vote_average: 7.8, ... }
```

#### `selectAndDownloadPoster(movieId, posterPath, overrides)`
```javascript
// Orquestador: verifica override → obtiene imágenes → selecciona → descarga
const relativePath = await selectAndDownloadPoster(
  603,                           // TMDb ID
  "/original/poster.jpg",        // Poster default
  {"603": "/custom/poster.jpg"}  // Overrides
);
```

---

## 🔄 Flujo Completo

```
┌─────────────────────────────────────────────────────┐
│ 1. Obtener movieInfo (TMDb search)                  │
└─────────────────────────────┬───────────────────────┘
                              │
                ┌─────────────▼──────────────┐
                │ selectAndDownloadPoster    │
                └─────────────┬──────────────┘
                              │
                ┌─────────────▼──────────────┐
                │ ¿Existe override manual?   │
                └──┬─────────────────────┬──┘
                   │                     │
              SÍ (📌) │              NO  │
                   │                     │
        ┌──────────▼─────┐   ┌──────────▼──────────┐
        │ Usar ese path  │   │ getMovieImages()    │
        └────────────────┘   └──────────┬──────────┘
                                        │
                            ┌───────────▼──────────┐
                            │ selectBestPoster()   │
                            │ (Aplica prioridades) │
                            └───────────┬──────────┘
                                        │
                            ┌───────────▼──────────┐
                            │ downloadPoster()     │
                            │ (Descarga imagen)    │
                            └──────────────────────┘
```

---

## ⚙️ Manejo de Errores

El sistema es **robusto y resiliente**:

- ❌ Si falla obtener imágenes → Usa poster original
- ❌ Si no hay posters en español → Usa sin idioma
- ❌ Si `getMovieImages()` falla → Fallback a `poster_path` original
- ❌ Si descarga falla → Devuelve `null` y continúa

**No rompe la ejecución**: Siempre continúa procesando películas.

---

## 📊 Estructura de `posterOverrides.json`

```json
{
  "_comentarios": "Puedes usar claves que comiencen con _ para notas",
  "603": "/custom/path/matrix.jpg",
  "13246": "posters/garfield.jpg",
  "550": null
}
```

- ✅ Claves numéricas = IDs de TMDb
- ✅ Valores = rutas a posters personalizados
- ✅ Claves con `_` = comentarios (ignoradas)
- ✅ Valores `null` = sin override (usa automático)

---

## 🔍 Debugging

Busca estos logs en la salida del script:

| Log | Significado |
|-----|------------|
| `🎨 Poster seleccionado` | Selección automática exitosa |
| `📌 Poster override aplicado` | Usando poster personalizado |
| `⚠️ No se pudieron obtener imágenes` | Fallback a poster original |
| `❌ Error en selección automática` | Algo falló, usando default |
| `⬇️ Descargando poster` | Descargando imagen |
| `✅ Poster guardado` | Descarga exitosa |

---

## 💡 Tips

1. **Prueba con una película**: Modifica `posterOverrides.json` con un ID conocido
2. **Revisa cache**: El archivo `cache.json` no se ve afectado
3. **movies.json**: Igual que antes, con posters mejorados
4. **Compatibilidad**: 100% backward compatible, puedes remover `posterOverrides.json` sin problemas

---

## 📝 Ejemplo Completo

### Cambio en tu flujo:

**Antes:**
```javascript
// Solo usaba poster_path de TMDb (a menudo no óptimo)
posterPath = await downloadPoster(movieInfo.poster_path, movieInfo.id);
```

**Ahora:**
```javascript
// Busca el mejor poster automáticamente, con opción de override
posterPath = await selectAndDownloadPoster(
  movieInfo.id, 
  movieInfo.poster_path, 
  posterOverrides
);
```

### Resultado:

```json
{
  "title": "The Matrix",
  "tmdbId": 603,
  "poster": "posters/603.jpg",
  "...": "otros campos"
}
```

---

¡Listo! 🎉 Tu script ahora selecciona los mejores posters automáticamente.
