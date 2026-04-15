# Optimizaciones Implementadas

## 1. Concurrencia Controlada

```js
const CONCURRENCY = 5; // Máximo de requests concurrentes
```

**Función `processInBatches`**: Procesa items en lotes limitando concurrencia. Reemplaza el bucle secuencial.

```js
await processInBatches(newMovies, async (movieData) => {
  // Procesa cada película
  // Se ejecutan hasta 5 concurrentemente
}, CONCURRENCY);
```

## 2. Cache Local (`cache.json`)

Estructura:
```json
{
  "titulo_normalizado_2012": { /* datos de TMDb */ }
}
```

**Beneficio**: Evita re-consultar TMDb por películas ya buscadas.

**Flujo**:
1. `loadCache()` - carga al inicio
2. `getCachedOrSearchMovie()` - verifica cache antes de buscar
3. `saveCache()` - persiste al final

## 3. Reutilizar Películas Existentes

- Carga `movies.json` existente al iniciar
- Compara películas nuevas vs existentes
- Reutiliza películas sin re-procesarlas
- Evita descargar posters duplicados

**Efecto**: Primera ejecución es lenta, siguientes son muy rápidas.

## 4. Optimizaciones Específicas

| Mejora | Antes | Ahora |
|--------|-------|-------|
| Delay entre requests | 350ms | 100ms |
| Búsqueda de películas | Secuencial | Paralela (5 concurrentes) |
| Re-búsquedas | Sí (siempre) | No (cache + existentes) |
| Descargas de posters | Siempre | Solo si no existen |

## 5. Logging de Rendimiento

```js
console.time("Total");        // inicio
console.time(`${title}`);     // por película
console.timeEnd(`${title}`);  // resultado
console.timeEnd("Total");     // tiempo total
```

## 6. Archivos Generados

- **`cache.json`**: Cache de búsquedas en TMDb (~2KB por película)
- **`movies.json`**: Salida final (sin cambios en estructura)
- **`manualMatches.json`**: Overrides manuales (sin cambios)

## Uso

```bash
node generateMovies.mjs
```

Primera ejecución: Lenta (procesa todas)
Siguientes: Rápidas (reutiliza + cache)

## Fórmula de Mejora

```
Tiempo = Películas_nuevas / CONCURRENCY * Delay
       + Reutilización (casi instantáneo)
       + Descarga_posters (igual que antes)
```

Con `CONCURRENCY=5` y `Delay=100ms`:
- Antes: N películas × 350ms = Muy lento
- Ahora: (N/5) películas × 100ms + cache = Mucho más rápido ⚡
