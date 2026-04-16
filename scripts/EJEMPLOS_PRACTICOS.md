# 🎬 EJEMPLOS PRÁCTICOS - Selección de Posters

## Ejemplo 1: Uso Completamente Automático (Recomendado)

### Paso 1: Ejecutar el script
```bash
node generateMovies.mjs
```

### Paso 2: Ver logs
```
📂 Inicializando...
💾 Cache cargado: 150 películas en cache
📌 0 poster override(s) cargados
🔎 The Matrix (1999)
🎨 Poster seleccionado (español): 7.8/10 (votos: 45)
⬇️ Descargando poster: 603.jpg
✅ Poster guardado: 603.jpg
```

### Paso 3: Resultado
- ✅ Script selecciona automáticamente el mejor poster
- ✅ Descarga en resolución óptima
- ✅ Guarda en `posters/603.jpg`
- ✅ Registra en `movies.json`

**Sin configuración adicional requerida** ✨

---

## Ejemplo 2: Con Poster Personalizado (Override)

### Paso 1: Obtener ID de TMDb
- Visita: https://www.themoviedb.org/
- Busca "The Matrix"
- URL: `https://www.themoviedb.org/movie/603`
- **ID: 603**

### Paso 2: Preparar archivo
- Tienes: `mi-poster-matrix-custom.jpg`
- Copia a: `scripts/posters/mi-poster-matrix-custom.jpg`

### Paso 3: Actualizar `posterOverrides.json`
**Cambiar de:**
```json
{
  "603": null
}
```

**A:**
```json
{
  "603": "posters/mi-poster-matrix-custom.jpg"
}
```

### Paso 4: Ejecutar script
```bash
node generateMovies.mjs
```

### Paso 5: Ver logs
```
📂 Inicializando...
📌 1 poster override(s) cargados
🔎 The Matrix (1999)
📌 Poster override aplicado
🎬 Match: "The Matrix" → "The Matrix"
```

### Paso 6: Resultado
- ✅ Usa tu poster personalizado
- ✅ No descarga desde TMDb
- ✅ Registra en `movies.json` con tu archivo

**Con control total** 🎨

---

## Ejemplo 3: Múltiples Overrides

### Configuración en `posterOverrides.json`
```json
{
  "_comentario": "Mis películas favoritas con posters personalizados",
  "603": "posters/matrix-4k.jpg",
  "680": "posters/pulp-fiction-special.jpg",
  "550": "posters/fight-club-artwork.jpg",
  "13246": "posters/garfield.jpg",
  "_otros": "Las demás películas usan selección automática"
}
```

### Carpeta `posters/`
```
posters/
├── 603.jpg (descargado automático)
├── 680.jpg (descargado automático)
├── matrix-4k.jpg (personalizado para 603)
├── pulp-fiction-special.jpg (personalizado para 680)
├── fight-club-artwork.jpg (personalizado para 550)
└── garfield.jpg (personalizado para 13246)
```

### Ejecución
```bash
node generateMovies.mjs
```

### Logs
```
📌 4 poster override(s) cargados
...
🔎 The Matrix (1999)
📌 Poster override aplicado (usando matrix-4k.jpg)
...
🔎 Pulp Fiction (1994)
📌 Poster override aplicado (usando pulp-fiction-special.jpg)
...
🔎 Fight Club (1999)
📌 Poster override aplicado (usando fight-club-artwork.jpg)
...
🔎 Garfield (2004)
📌 Poster override aplicado (usando garfield.jpg)
...
🔎 Star Wars (1977)
🎨 Poster seleccionado (español): 8.5/10 (votos: 120)
(automático, sin override)
```

### Resultado
- ✅ 4 películas con posters personalizados
- ✅ Las demás con selección automática
- ✅ Control híbrido

---

## Ejemplo 4: Fallback a Automático

### Escenario
- Tienes override configurado: `"603": "posters/matriz-vieja.jpg"`
- Pero el archivo no existe o ruta está mal

### ¿Qué pasa?
```
🔎 The Matrix (1999)
📌 Poster override solicitado
⚠️ No se pudieron obtener imágenes, usando poster por defecto
⬇️ Descargando poster: 603.jpg
✅ Poster guardado: 603.jpg
```

### Resultado
- ✅ Sistema es resiliente
- ✅ Si falla override → automático
- ✅ Nunca falla completamente

---

## Ejemplo 5: Rutas Absolutas

### Sistema Windows
```json
{
  "603": "C:\\Users\\Dany\\Pictures\\Matrix-Custom.jpg",
  "680": "D:\\Archivos\\Películas\\Posters\\Pulp-Fiction.jpg"
}
```

### Sistema Linux/Mac
```json
{
  "603": "/home/usuario/Descargas/matrix.jpg",
  "680": "/Volumes/Películas/posters/pulp.jpg"
}
```

### Ejecución
```bash
node generateMovies.mjs
```

### Logs
```
📌 2 poster override(s) cargados
🔎 The Matrix (1999)
📌 Poster override aplicado
```

### Resultado
- ✅ Funciona con rutas absolutas
- ✅ Archivos desde cualquier lugar
- ✅ Máxima flexibilidad

---

## Ejemplo 6: Mezcla de Estrategias

### Configuración
```json
{
  "603": "posters/matrix-personalizado.jpg",
  "680": null,
  "550": null,
  "13246": "C:\\Mi_Coleccion\\garfield-special.jpg",
  "_nota": "603 y 13246 con override, 680 y 550 automáticos"
}
```

### Flujo
1. **The Matrix (603)**
   - Tiene override local → Usa `posters/matrix-personalizado.jpg`
   - Log: 📌 Poster override aplicado

2. **Pulp Fiction (680)**
   - Sin override → Selección automática
   - Log: 🎨 Poster seleccionado (español)

3. **Fight Club (550)**
   - Sin override → Selección automática
   - Log: 🎨 Poster seleccionado (español)

4. **Garfield (13246)**
   - Tiene override absoluto → Usa archivo externo
   - Log: 📌 Poster override aplicado

### Resultado
```
📌 2 poster override(s) cargados
🔎 The Matrix (1999)
📌 Poster override aplicado
🔎 Pulp Fiction (1994)
🎨 Poster seleccionado (español): 8.2/10 (votos: 88)
🔎 Fight Club (1999)
🎨 Poster seleccionado (español): 8.1/10 (votos: 95)
🔎 Garfield (2004)
📌 Poster override aplicado
```

**Control híbrido perfecto** ✨

---

## Ejemplo 7: Limpieza y Reset

### ¿Quieres volver al automático 100%?
```bash
# Opción 1: Vaciar el archivo
echo "{}" > posterOverrides.json

# Opción 2: Eliminar el archivo (se creará vacío)
rm posterOverrides.json
# o en Windows:
del posterOverrides.json
```

### ¿Quieres re-descargar posters?
```bash
# Opción 1: Eliminar caché pero mantener películas
rm cache.json

# Opción 2: También limpiar posters descargados
rm posters/*.jpg
```

### ¿Quieres empezar desde cero?
```bash
# Eliminar todo y dejar solo el script
rm cache.json movies.json posterOverrides.json
rm -rf posters/
node generateMovies.mjs
```

---

## Ejemplo 8: Debugging

### Problema: "No sé qué está pasando"

**Paso 1:** Habilitar verbose (agregar logs)
- Ver líneas con 🎨, 📌, ⚠️, ❌

**Paso 2:** Verificar `posterOverrides.json`
```bash
# Validar JSON
node -e "const x = require('./posterOverrides.json'); console.log(x);"
```

**Paso 3:** Verificar archivos
```bash
# Ver qué hay en posters/
ls posters/

# Ver qué hay en posterOverrides.json
cat posterOverrides.json
```

**Paso 4:** Ejecutar con debug
```bash
# En el script, buscar líneas con console.log
node generateMovies.mjs 2>&1 | grep -E "🎨|📌|⚠️|❌"
```

---

## Resumen Rápido

| Escenario | Configuración | Resultado |
|-----------|---------------|-----------|
| Automático 100% | Vacío | 🎨 Mejor poster automático |
| 1 Override | `"603": "ruta"` | 📌 Ese poster |
| Múltiples | 4 entradas | 📌 Los 4 personalizados, otros auto |
| Rutas Abs | `"C:\\..."` | 📌 Archivo de esa ruta |
| Fallback | Ruta inválida | 🎨 Automático |
| Reset | Eliminar archivo | 🎨 Vuelve a automático |

---

## Tips Finales

✅ **JSON válido:** Usa: https://jsonlint.com/
✅ **IDs de TMDb:** https://www.themoviedb.org/
✅ **Archivos:** Guarda posters con nombres cortos
✅ **Rutas:** Copia-pega desde tu explorador
✅ **Logs:** Busca símbolos emoji para encontrar info
✅ **Errores:** El sistema es resiliente, nunca falla completamente

¡Listo para usar! 🚀
