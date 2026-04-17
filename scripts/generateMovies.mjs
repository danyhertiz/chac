import fs from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_KEY = "79babdd2d24b858c4488b987a2743aef";
const MOVIES_FOLDER = "D:/Videos/Peliculas/HD"; // carpeta donde están tus videos
const OUTPUT_JSON = "./movies.json";
const MANUAL_MATCHES_JSON = "./manualMatches.json";
const CACHE_JSON = "./cache.json";
const POSTER_OVERRIDES_JSON = "./posterOverrides.json";
const POSTERS_FOLDER = path.join(__dirname, "..", "posters");
const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const CONCURRENCY = 5; // Máximo de requests concurrentes a TMDb

/**
 * Obtiene la duración del archivo de video en minutos
 * Usa ffprobe para obtener metadatos precisos
 * @param {string} filePath - Ruta absoluta al archivo de video
 * @returns {Promise<number|null>} - Duración en minutos (entero) o null si hay error
 */
async function getVideoDuration(filePath) {
  try {
    // Comando ffprobe para obtener duración en segundos
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    
    const durationSeconds = parseFloat(
      execSync(command, { encoding: "utf-8" }).trim()
    );
    
    if (isNaN(durationSeconds)) {
      console.warn(`⚠️ No se pudo obtener duración: ${path.basename(filePath)}`);
      return null;
    }
    
    const durationMinutes = Math.round(durationSeconds / 60);
    return durationMinutes;
  } catch (error) {
    console.warn(`⚠️ Error obteniendo duración de ${path.basename(filePath)}: ${error.message}`);
    return null;
  }
}


/**
 * Extrae título y año del nombre del archivo
 * Ejemplo: "Abraham Lincoln Cazador de Vampiros (2012).mkv" 
 * → { title: "Abraham Lincoln Cazador de Vampiros", year: "2012" }
 */
function parseFileName(fileName) {
  // Ejemplo: "The Matrix (1999).mp4"
  const match = fileName.match(/^(.*)\((\d{4})\)/);
  if (!match) return null;

  return {
    title: match[1].trim(),
    year: match[2]
  };
}

/**
 * Normaliza texto para comparación:
 * - Convierte a minúsculas
 * - Elimina acentos
 * - Elimina caracteres especiales
 * - Elimina espacios extra
 */
function normalize(text) {
  if (!text) return "";
  
  return text
    .toLowerCase()
    .normalize("NFD") // Descompone caracteres acentuados
    .replace(/[\u0300-\u036f]/g, "") // Elimina marcas diacríticas
    .replace(/[^a-z0-9\s]/g, "") // Elimina caracteres especiales
    .replace(/\s+/g, " ") // Elimina espacios extra
    .trim();
}

/**
 * Calcula similitud entre dos strings comparando palabras individuales
 * Devuelve: 1 (exacto), 0.8 (alta similitud), 0.5 (media), 0 (baja/diferente)
 */
function similarity(a, b) {
  if (!a || !b) return 0;
  
  const normA = normalize(a);
  const normB = normalize(b);
  
  // Exacto
  if (normA === normB) return 1;
  
  // Dividir en palabras
  const wordsA = normA.split(" ").filter(w => w.length > 0);
  const wordsB = normB.split(" ").filter(w => w.length > 0);
  
  // Si uno es vacío
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  
  // Contar palabras comunes
  const common = wordsA.filter(w => wordsB.includes(w));
  const ratio = common.length / Math.max(wordsA.length, wordsB.length);
  
  // Escala: 1 (exacto), 0.8 (>60%), 0.5 (>40%), 0 (<40%)
  if (ratio >= 1) return 1;
  if (ratio > 0.6) return 0.8;
  if (ratio > 0.4) return 0.5;
  
  return 0;
}

/**
 * Encuentra la mejor coincidencia en los resultados de TMDb
 * Sistema de puntuación:
 * - +2 si coincide con title
 * - +2 si coincide con original_title
 * - +1.5 si el año coincide (solo si year es != null)
 * - +popularidad (bonus normalizado)
 * - -2 si es documental (genre_id 99)
 * - -2 si contiene palabras clave sospechosas
 */
function findBestMatch(results, fileTitle, year) {
  if (!results || results.length === 0) return null;
  
  // Palabras clave que indican contenido secundario/no-película
  const badKeywords = ["making", "behind", "documentary", "featurette", "short film"];
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const movie of results) {
    let score = 0;
    
    // Comparar contra title
    const titleSimilarity = similarity(fileTitle, movie.title);
    score += titleSimilarity * 2;
    
    // Comparar contra original_title
    const originalTitleSimilarity = similarity(fileTitle, movie.original_title);
    score += originalTitleSimilarity * 2;
    
    // Comparar año (solo si year está definido)
    if (year && movie.release_date && movie.release_date.startsWith(year)) {
      score += 1.5;
    }
    
    // Bonus de popularidad (normalizado: máximo +1)
    if (movie.popularity) {
      score += Math.min(movie.popularity / 50, 1);
    }
    
    // Penalizar documentales (genre_id 99)
    if (movie.genre_ids && movie.genre_ids.includes(99)) {
      score -= 2;
      console.log(`⚠️ Penalizado posible documental: "${movie.title}"`);
    }
    
    // Penalizar palabras clave sospechosas en title o original_title
    const titleLower = normalize(movie.title);
    const originalTitleLower = normalize(movie.original_title);
    
    for (const keyword of badKeywords) {
      const keywordNorm = normalize(keyword);
      if (titleLower.includes(keywordNorm) || originalTitleLower.includes(keywordNorm)) {
        score -= 2;
        console.log(`⚠️ Penalizado por palabra clave: "${movie.title}" (contiene "${keyword}")`);
        break; // Solo penalizar una vez por película
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = movie;
    }
  }
  
  // Warning si el score es bajo (pero no en búsquedas sin año)
  if (year && bestScore < 2) {
    console.warn(`⚠️ Posible coincidencia débil: "${fileTitle}" (score: ${bestScore.toFixed(2)})`);
  }
  
  return bestMatch;
}

/**
 * Calcula ajuste de score basado en comparación de duración
 * @param {number|null} localRuntime - Duración en minutos del archivo local
 * @param {number|null} tmdbRuntime - Duración en minutos de TMDb
 * @returns {number} - Ajuste de score (-2, -1, 0, +1, +2)
 */
function calculateRuntimeBonus(localRuntime, tmdbRuntime) {
  if (!localRuntime || !tmdbRuntime) return 0;
  
  const diff = Math.abs(localRuntime - tmdbRuntime);
  
  if (diff <= 5) {
    console.log(`📊 Ajuste por duración: +2 (${localRuntime}min vs ${tmdbRuntime}min)`);
    return 2;
  } else if (diff <= 10) {
    console.log(`📊 Ajuste por duración: +1 (${localRuntime}min vs ${tmdbRuntime}min)`);
    return 1;
  } else {
    console.log(`📊 Penalización por duración: -2 (${localRuntime}min vs ${tmdbRuntime}min - diferencia: ${diff}min)`);
    return -2;
  }
}


/**
 * Crea un objeto película fallback cuando no se encuentra en TMDb
 */
function createFallbackMovie(title, year, file, parsedTitle, parsedYear) {
  return {
    title: title,
    originalTitle: title,
    year: year,
    overview: "No disponible",
    originalOverview: "",
    poster: null,
    genres: [],
    tmdbId: null,
    sourceFile: file,
    parsedTitle: parsedTitle,
    parsedYear: parsedYear
  };
}

/**
 * Normaliza las claves de manualMatches.json
 * - Ignora entradas que comienzan con "_" (comentarios)
 * - Normaliza todas las claves para consistencia
 * - Valida que los tmdbIds sean números válidos
 * 
 * @param {Object} rawData - Datos crudos de manualMatches.json
 * @returns {Object} - Datos normalizados { claveNormalizada: tmdbId }
 */
function normalizeManualMatches(rawData) {
  const normalized = {};
  let totalEntries = 0;
  let skippedEntries = 0;

  for (const [key, value] of Object.entries(rawData)) {
    totalEntries++;

    // Ignorar claves que comienzan con "_" (comentarios)
    if (key.startsWith("_")) {
      console.log(`ℹ️ Ignorado comentario en manualMatches: "${key}"`);
      skippedEntries++;
      continue;
    }

    // Soportar ambos formatos: número directo o objeto con id y type
    let entry;

    if (typeof value === "number") {
      // Formato antiguo: solo número
      entry = { id: value, type: "movie" };
    } else if (typeof value === "object" && value && value.id) {
      // Formato nuevo: { id, type }
      const tmdbId = Number(value.id);
      if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
        console.warn(
          `⚠️ Entrada inválida en manualMatches: "${key}" → ID "${value.id}" (debe ser número positivo)`
        );
        skippedEntries++;
        continue;
      }
      entry = {
        id: tmdbId,
        type: value.type === "tv" ? "tv" : "movie"
      };
    } else {
      console.warn(
        `⚠️ Entrada inválida en manualMatches: "${key}" → "${JSON.stringify(value)}" (debe ser número o {id, type})`
      );
      skippedEntries++;
      continue;
    }

    // Normalizar la clave
    const normalizedKey = normalize(key);
    if (!normalizedKey) {
      console.warn(`⚠️ Clave en blanco después de normalizar: "${key}"`);
      skippedEntries++;
      continue;
    }

    normalized[normalizedKey] = entry;
  }

  if (skippedEntries > 0) {
    console.log(
      `✓ Cargados overrides manuales: ${totalEntries - skippedEntries}/${totalEntries} válidos`
    );
  }

  return normalized;
}

/**
 * Carga las coincidencias manuales desde manualMatches.json
 * Normaliza automáticamente las claves para consistencia
 * 
 * @returns {Promise<Object>} - Matchs manuales normalizados
 */
async function loadManualMatches() {
  try {
    if (await fs.pathExists(MANUAL_MATCHES_JSON)) {
      const rawData = await fs.readJson(MANUAL_MATCHES_JSON);
      return normalizeManualMatches(rawData);
    }
  } catch (error) {
    console.warn(`⚠️ Error leyendo manualMatches.json:`, error.message);
  }
  return {};
}

/**
 * Carga el cache de TMDb desde cache.json
 */
async function loadCache() {
  try {
    if (await fs.pathExists(CACHE_JSON)) {
      const data = await fs.readJson(CACHE_JSON);
      console.log(`💾 Cache cargado: ${Object.keys(data).length} películas en cache`);
      return data;
    }
  } catch (error) {
    console.warn(`⚠️ Error leyendo cache.json:`, error.message);
  }
  return {};
}

/**
 * Guarda el cache en cache.json
 */
async function saveCache(cache) {
  try {
    await fs.writeJson(CACHE_JSON, cache, { spaces: 2 });
  } catch (error) {
    console.warn(`⚠️ Error guardando cache.json:`, error.message);
  }
}

/**
 * Obtiene una película del cache o busca en TMDb
 * Clave del cache: "titulo_normalizado_2012"
 * También cachea la duración local del archivo de video
 * 
 * Protección mejorada contra cache corrupto:
 * - Preserva cache válido incluso sin tmdbId
 * - Nunca borra cache automáticamente
 * - Si búsqueda falla, usa cache anterior como fallback
 */
async function getCachedOrSearchMovie(title, year, filePath, manualMatches, cache) {
  const cacheKey = `${normalize(title)}_${year}`;
  const cachedMovie = cache[cacheKey];
  
  // 🔥 Detectar si hay override manual
  const normalizedTitle = normalize(title);
  const hasManualOverride = manualMatches[normalizedTitle];
  
  // 🔥 PRIORIDAD: override manual invalida el cache
  if (hasManualOverride) {
    console.log(`🧹 Ignorando cache por override manual: ${title}`);
  } else if (cachedMovie && typeof cachedMovie === "object") {
    // Cache válido solo si tiene tmdbId Y runtime
    if (cachedMovie.tmdbId && cachedMovie.runtime) {
      console.log(`✓ Desde cache: ${title}`);
      return cachedMovie;
    } else if (cachedMovie.tmdbId && !cachedMovie.runtime) {
      // Cache incompleto: falta runtime
      console.log(`⚠️ Cache incompleto (sin runtime), se intentará corregir: ${title}`);
    } else {
      // Cache sin tmdbId
      console.log(`⚠️ Cache sin tmdbId, se intentará corregir: ${title}`);
    }
  }
  
  // Obtener duración local si no está en cache válido
  let localRuntime = null;
  if (filePath) {
    const absolutePath = path.join(MOVIES_FOLDER, filePath);
    localRuntime = await getVideoDuration(absolutePath);
    if (localRuntime) {
      console.log(`⏱️ Runtime local: ${localRuntime} min`);
    }
  }
  
  // Buscar en TMDb
  const movieData = await searchMovie(title, year, localRuntime, manualMatches);
  
  // Si falla la búsqueda, conservar cache antiguo
  if (!movieData && cachedMovie) {
    console.log(`🛡️ Usando cache anterior para: ${title}`);
    return cachedMovie;
  }
  
  if (movieData) {
    // Agregar runtime al objeto guardado en cache
    movieData.runtime = localRuntime;
    cache[cacheKey] = movieData;
  }
  
  return movieData;
}

/**
 * Carga las películas ya procesadas desde movies.json
 */
async function loadExistingMovies() {
  try {
    if (await fs.pathExists(OUTPUT_JSON)) {
      const data = await fs.readJson(OUTPUT_JSON);
      console.log(`📚 ${data.length} películas existentes cargadas`);
      
      // Crear mapa para búsqueda rápida: tmdbId -> película
      const movieMap = new Map();
      data.forEach(movie => {
        if (movie.tmdbId) {
          movieMap.set(movie.tmdbId, movie);
        }
      });
      
      return { movies: data, movieMap };
    }
  } catch (error) {
    console.warn(`⚠️ Error leyendo movies.json:`, error.message);
  }
  return { movies: [], movieMap: new Map() };
}

/**
 * Procesa un array de items de forma concurrente en lotes
 * @param {Array} items - Items a procesar
 * @param {Function} worker - Función async que procesa un item
 * @param {number} concurrency - Máximo de items concurrentes
 */
async function processInBatches(items, worker, concurrency = CONCURRENCY) {
  const results = [];
  const executing = [];
  
  for (const [index, item] of items.entries()) {
    const promise = Promise.resolve().then(() => worker(item, index));
    results.push(promise);
    
    if (concurrency <= items.length) {
      executing.push(
        promise.then(() => executing.splice(executing.indexOf(promise), 1))
      );
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }
  
  return Promise.all(results);
}

/**
 * Busca una película en TMDb usando búsqueda mejorada con validación de runtime
 * 
 * PRIORIDAD ABSOLUTA DE OVERRIDES MANUALES:
 * - Si existe match manual → fetch directo por ID, sin búsqueda TMDb
 * - Si el ID manual es inválido → log de error y fallback a búsqueda normal
 * 
 * Luego verifica búsqueda con scoring robusto
 * Para los TOP 3 candidatos, obtiene runtime de TMDb y valida contra duración local
 * 
 * @param {string} title - Título de la película
 * @param {number} year - Año de lanzamiento
 * @param {number|null} localRuntime - Duración en minutos del archivo local
 * @param {Object} manualMatches - Coincidencias manuales (ya normalizadas)
 * @returns {Promise<Object|null>}
 */
async function searchMovie(title, year, localRuntime, manualMatches) {
  // ==========================================
  // 1️⃣ VERIFICAR OVERRIDE MANUAL (PRIORIDAD ABSOLUTA)
  // ==========================================
  const normalizedTitle = normalize(title);
  const manualEntry = manualMatches[normalizedTitle];

  if (manualEntry) {
    const { id, type } = manualEntry;

    console.log(`📌 Usando override manual (${type}): ${id}`);

    try {
      const endpoint = type === "tv" ? "tv" : "movie";

      const url = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${API_KEY}&language=es-MX`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      // Validar que la respuesta es válida
      if (!data || !data.id) {
        throw new Error("Respuesta inválida de TMDb (sin ID)");
      }

      // LOG DETALLADO DE MATCH MANUAL
      console.log(`   ✅ Archivo: "${title}"`);
      console.log(`   ✅ TMDb ID: ${data.id}`);
      console.log(`   ✅ Título TMDb: "${data.title || data.name}" (${data.original_title || data.original_name})`);

      // Normalize fields so the rest of the script continues to work
      return {
        ...data,
        title: data.title || data.name,
        original_title: data.original_title || data.original_name,
        release_date: data.release_date || data.first_air_date,
        runtime: data.runtime || data.episode_run_time?.[0] || null
      };

    } catch (error) {
      console.error(
        `⚠️ Match manual INVÁLIDO para: "${title}"\n` +
        `   ID proporcionado: ${id}\n` +
        `   Error: ${error.message}\n` +
        `   → Intentando búsqueda normal...`
      );
      // Continuar con búsqueda normal como fallback
    }
  }
  
  // ==========================================
  // 2️⃣ BÚSQUEDA NORMAL EN TMDB CON AÑO
  // ==========================================
  let url = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(title)}&primary_release_year=${year}&language=es-MX`;
  
  try {
    let res = await fetch(url);
    let data = await res.json();
    let results = data.results || [];
    
    // Si encontró resultados con año, usar esos
    if (results.length > 0) {
      const bestMatch = await findBestMatchWithRuntime(results, title, year, localRuntime);
      if (bestMatch) return bestMatch;
    }
    
    // ==========================================
    // 3️⃣ FALLBACK: BÚSQUEDA SIN AÑO
    // ==========================================
    console.log(`↩️ Reintentando sin año: ${title}`);
    url = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(title)}&language=es-MX`;
    
    res = await fetch(url);
    data = await res.json();
    results = data.results || [];
    
    if (results.length > 0) {
      // Sin año, no aplicar bonus por año en la puntuación
      const bestMatch = await findBestMatchWithRuntime(results, title, null, localRuntime);
      if (bestMatch) {
        console.log(`✓ Encontrada sin año: ${title}`);
        return bestMatch;
      }
    }
    
    // No encontrado ni con ni sin año
    console.warn(`❌ No encontrada en TMDb: "${title}" (${year})`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error en búsqueda TMDb:`, error.message);
    return null;
  }
}

/**
 * Encuentra mejor coincidencia considerando runtime
 * Para los TOP 3 candidatos, obtiene runtime de TMDb y valida
 * 
 * @param {Array} results - Resultados de búsqueda de TMDb
 * @param {string} fileTitle - Título del archivo
 * @param {number|null} year - Año esperado
 * @param {number|null} localRuntime - Runtime local en minutos
 * @returns {Promise<Object|null>}
 */
async function findBestMatchWithRuntime(results, fileTitle, year, localRuntime) {
  if (!results || results.length === 0) return null;
  
  // Calcular scores iniciales para todos los resultados
  const scoredResults = results.map(movie => {
    let score = 0;
    
    // Comparar contra title
    const titleSimilarity = similarity(fileTitle, movie.title);
    score += titleSimilarity * 2;
    
    // Comparar contra original_title
    const originalTitleSimilarity = similarity(fileTitle, movie.original_title);
    score += originalTitleSimilarity * 2;
    
    // Comparar año (solo si year está definido)
    if (year && movie.release_date && movie.release_date.startsWith(year)) {
      score += 1.5;
    }
    
    // Bonus de popularidad (normalizado: máximo +1)
    if (movie.popularity) {
      score += Math.min(movie.popularity / 50, 1);
    }
    
    // Penalizar documentales (genre_id 99)
    if (movie.genre_ids && movie.genre_ids.includes(99)) {
      score -= 2;
      console.log(`⚠️ Penalizado posible documental: "${movie.title}"`);
    }
    
    // Penalizar palabras clave sospechosas en title o original_title
    const badKeywords = ["making", "behind", "documentary", "featurette", "short film"];
    const titleLower = normalize(movie.title);
    const originalTitleLower = normalize(movie.original_title);
    
    for (const keyword of badKeywords) {
      const keywordNorm = normalize(keyword);
      if (titleLower.includes(keywordNorm) || originalTitleLower.includes(keywordNorm)) {
        score -= 2;
        console.log(`⚠️ Penalizado por palabra clave: "${movie.title}" (contiene "${keyword}")`);
        break;
      }
    }
    
    return { movie, score };
  });
  
  // Ordenar por score descendente
  scoredResults.sort((a, b) => b.score - a.score);
  
  // Obtener TOP 3 candidatos para validar runtime
  const topCandidates = scoredResults.slice(0, 3);
  
  // Para cada candidato, obtener runtime de TMDb y comparar
  for (const candidate of topCandidates) {
    try {
      const detailedMovie = await getMovieDetails(candidate.movie.id);
      
      if (detailedMovie) {
        const tmdbRuntime = detailedMovie.runtime || detailedMovie.episode_run_time?.[0] || null;
        
        if (tmdbRuntime) {
          console.log(`🎬 TMDb runtime: ${tmdbRuntime} min`);
        }
        
        // Ajustar score según runtime si se tiene información local
        if (localRuntime && tmdbRuntime) {
          const runtimeBonus = calculateRuntimeBonus(localRuntime, tmdbRuntime);
          candidate.score += runtimeBonus;
        }
        
        // Guardar el runtime en el objeto para posterior uso
        candidate.movie.runtime = tmdbRuntime;
      }
      
      // Pequeña pausa para respetar rate limit de TMDb
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      console.warn(`⚠️ Error obteniendo runtime para ${candidate.movie.title}:`, error.message);
    }
  }
  
  // Reordenar por score final y devolver el mejor
  topCandidates.sort((a, b) => b.score - a.score);
  const bestMatch = topCandidates[0];
  
  // Warning si el score es bajo (pero no en búsquedas sin año)
  if (year && bestMatch.score < 2) {
    console.warn(`⚠️ Posible coincidencia débil: "${fileTitle}" (score: ${bestMatch.score.toFixed(2)})`);
  }
  
  return bestMatch.movie;
}

// Fetch detailed movie data with Spanish localization
async function getMovieDetails(movieId) {
  const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=es-MX`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data || null;
  } catch (error) {
    console.error(`❌ Error fetching details for movie ${movieId}:`, error.message);
    return null;
  }
}

// Transform genres array to Spanish names
function transformGenres(genresArray) {
  if (!genresArray || !Array.isArray(genresArray)) {
    return [];
  }
  return genresArray.map(genre => genre.name);
}

/**
 * Carga los overrides manuales de posters desde posterOverrides.json
 * Formato: { "tmdbId": "/custom/path/poster.jpg", ... }
 * 
 * @returns {Promise<Object>} - Overrides manuales { tmdbId: customPath }
 */
async function loadPosterOverrides() {
  try {
    if (await fs.pathExists(POSTER_OVERRIDES_JSON)) {
      const overrides = await fs.readJson(POSTER_OVERRIDES_JSON);
      const validOverrides = {};
      let count = 0;
      
      for (const [tmdbIdStr, customPath] of Object.entries(overrides)) {
        // Ignorar claves que comienzan con "_" (comentarios)
        if (tmdbIdStr.startsWith("_")) {
          continue;
        }
        
        const tmdbId = Number(tmdbIdStr);
        if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
          console.warn(`⚠️ Override inválido: "${tmdbIdStr}" (debe ser ID numérico)`);
          continue;
        }
        
        if (typeof customPath !== "string" || !customPath.trim()) {
          console.warn(`⚠️ Override sin path válido para tmdbId: ${tmdbId}`);
          continue;
        }
        
        validOverrides[tmdbId] = customPath;
        count++;
      }
      
      if (count > 0) {
        console.log(`📌 ${count} poster override(s) cargados`);
      }
      
      return validOverrides;
    }
  } catch (error) {
    console.warn(`⚠️ Error leyendo posterOverrides.json:`, error.message);
  }
  return {};
}

/**
 * Obtiene todas las imágenes disponibles para una película desde TMDb
 * 
 * @param {number} movieId - ID de la película en TMDb
 * @returns {Promise<Array|null>} - Array de posters o null si hay error
 */
async function getMovieImages(movieId) {
  const url = `https://api.themoviedb.org/3/movie/${movieId}/images?api_key=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    return data.posters || [];
  } catch (error) {
    console.warn(`⚠️ Error obteniendo imágenes para ${movieId}:`, error.message);
    return null;
  }
}

/**
 * Selecciona el mejor poster de una lista según criterios de priorización
 * 
 * Prioridad:
 * 1. Posters en español (iso_639_1 === "es")
 * 2. Posters sin idioma (iso_639_1 === null)
 * 3. Cualquier otro poster disponible
 * 
 * Ordenamiento dentro de cada categoría:
 * 1. vote_average (descendente)
 * 2. vote_count (descendente)
 * 3. width (descendente)
 * 
 * @param {Array} posters - Array de objetos poster de TMDb
 * @returns {Object|null} - El mejor poster o null si no hay posters
 */
function selectBestPoster(posters) {
  if (!Array.isArray(posters) || posters.length === 0) {
    return null;
  }
  
  // Categorizar posters
  const spanishPosters = posters.filter(p => p.iso_639_1 === "es");
  const nullLanguagePosters = posters.filter(p => p.iso_639_1 === null);
  const otherPosters = posters.filter(p => p.iso_639_1 !== "es" && p.iso_639_1 !== null);
  
  // Función auxiliar para ordenar posters
  const sortPosters = (arr) => {
    return arr.sort((a, b) => {
      // 1. vote_average (descendente)
      if (a.vote_average !== b.vote_average) {
        return b.vote_average - a.vote_average;
      }
      // 2. vote_count (descendente)
      if (a.vote_count !== b.vote_count) {
        return b.vote_count - a.vote_count;
      }
      // 3. width (descendente)
      return b.width - a.width;
    });
  };
  
  // Priorizar según categoría
  if (spanishPosters.length > 0) {
    const best = sortPosters(spanishPosters)[0];
    console.log(`🎨 Poster seleccionado (español): ${best.vote_average}/10 (votos: ${best.vote_count})`);
    return best;
  }
  
  if (nullLanguagePosters.length > 0) {
    const best = sortPosters(nullLanguagePosters)[0];
    console.log(`🎨 Poster seleccionado (sin idioma): ${best.vote_average}/10 (votos: ${best.vote_count})`);
    return best;
  }
  
  if (otherPosters.length > 0) {
    const best = sortPosters(otherPosters)[0];
    console.log(`🎨 Poster seleccionado (${best.iso_639_1}): ${best.vote_average}/10 (votos: ${best.vote_count})`);
    return best;
  }
  
  return null;
}

async function downloadPoster(posterPath, tmdbId) {
  if (!posterPath) {
    return null;
  }

  const fileName = `${tmdbId}.jpg`;
  const localFilePath = path.join(POSTERS_FOLDER, fileName);
  const relativePath = path.join("posters", fileName).replace(/\\/g, "/");

  // Si el archivo ya existe, devuelve la ruta relativa
  if (await fs.pathExists(localFilePath)) {
    console.log(`📦 Poster ya existe: ${fileName}`);
    return relativePath;
  }

  try {
    const imageUrl = `${TMDB_POSTER_BASE_URL}${posterPath}`;
    console.log(`⬇️ Descargando poster: ${fileName}`);
    
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      console.error(`❌ Error descargando poster (${response.status}): ${fileName}`);
      return null;
    }

    const buffer = await response.buffer();
    await fs.writeFile(localFilePath, buffer);
    
    console.log(`✅ Poster guardado: ${fileName}`);
    return relativePath;
  } catch (error) {
    console.error(`❌ Error al descargar poster ${fileName}:`, error.message);
    return null;
  }
}

/**
 * Maneja descarga de posters personalizados desde overrides
 * Verifica si existe override manual para el tmdbId
 * Si existe, devuelve ese path; si no, busca y descarga automáticamente
 * 
 * @param {number} movieId - ID de la película en TMDb
 * @param {string|null} originalPosterPath - Poster por defecto de TMDb
 * @param {Object} posterOverrides - Overrides manuales { tmdbId: customPath }
 * @returns {Promise<string|null>} - Ruta relativa al poster o null
 */
async function selectAndDownloadPoster(movieId, originalPosterPath, posterOverrides) {
  // 1️⃣ Verificar si existe override manual
  if (posterOverrides[movieId]) {
    console.log(`📌 Poster override aplicado`);
    return posterOverrides[movieId];
  }
  
  // 2️⃣ Intentar seleccionar poster automáticamente
  try {
    const allPosters = await getMovieImages(movieId);
    
    if (!allPosters) {
      console.log(`⚠️ No se pudieron obtener imágenes, usando poster por defecto`);
      return await downloadPoster(originalPosterPath, movieId);
    }
    
    if (allPosters.length === 0) {
      console.log(`⚠️ No hay posters disponibles, usando poster por defecto`);
      return await downloadPoster(originalPosterPath, movieId);
    }
    
    // Seleccionar el mejor poster
    const bestPoster = selectBestPoster(allPosters);
    
    if (bestPoster && bestPoster.file_path) {
      return await downloadPoster(bestPoster.file_path, movieId);
    } else {
      console.log(`⚠️ No se pudo seleccionar mejor poster, usando por defecto`);
      return await downloadPoster(originalPosterPath, movieId);
    }
  } catch (error) {
    console.warn(`⚠️ Error en selección automática de poster: ${error.message}`);
    console.log(`   → Usando poster por defecto`);
    return await downloadPoster(originalPosterPath, movieId);
  }
}

async function initializePostersFolder() {
  try {
    await fs.ensureDir(POSTERS_FOLDER);
    console.log(`📁 Carpeta de posters lista: ${POSTERS_FOLDER}`);
  } catch (error) {
    console.error(`❌ Error creando carpeta de posters:`, error.message);
    throw error;
  }
}

async function main() {
  console.time("Total");
  
  await initializePostersFolder();

  // Cargar datos previos
  console.log("📂 Inicializando...");
  const manualMatches = await loadManualMatches();
  const cache = await loadCache();
  const posterOverrides = await loadPosterOverrides();
  const { movies: existingMovies, movieMap: existingMovieMap } = await loadExistingMovies();

  const files = await fs.readdir(MOVIES_FOLDER);
  const videoFiles = files.filter(f => 
    [".mp4", ".mkv", ".avi"].includes(path.extname(f).toLowerCase())
  );

  console.log(`📹 ${videoFiles.length} archivos de video encontrados\n`);

  // Separar películas nuevas de las existentes
  const moviesToProcess = [];
  const processedIds = new Set();

  for (const file of videoFiles) {
    const parsed = parseFileName(file);
    if (!parsed) {
      console.log(`❌ No se pudo parsear: ${file}`);
      continue;
    }

    const normalizedTitle = normalize(parsed.title);
    const cacheKey = `${normalizedTitle}_${parsed.year}`;

    // Verificar si existe override manual
    const hasManualOverride = manualMatches[normalizedTitle];

    // Buscar en películas existentes
    const foundInExisting = existingMovies.find(
      m => `${normalize(m.title)}_${m.year}` === cacheKey
    );

    // 🔥 PRIORIDAD: si hay override manual, SIEMPRE reprocesar
    if (hasManualOverride) {
      console.log(`🔄 Reprocesando por override manual: ${parsed.title}`);
      
      moviesToProcess.push({
        type: "new",
        file,
        parsed
      });
      
    } else if (
      foundInExisting &&
      !processedIds.has(foundInExisting.tmdbId) &&
      foundInExisting.runtime
    ) {
      
      console.log(`📦 Usando existente: ${parsed.title}`);
      moviesToProcess.push({
        type: "existing",
        file,
        parsed,
        movie: foundInExisting
      });
      
      processedIds.add(foundInExisting.tmdbId);

    } else {
      
      moviesToProcess.push({
        type: "new",
        file,
        parsed
      });
    }
  }

  // Procesar películas nuevas en lotes con concurrencia controlada
  const newMovies = moviesToProcess.filter(m => m.type === "new").map(m => ({
    file: m.file,
    parsed: m.parsed,
    posterOverrides: posterOverrides
  }));

  const processedNewMovies = await processInBatches(
    newMovies,
    async (movieData) => {
      const { file, parsed, posterOverrides } = movieData;
      console.log(`🔎 ${parsed.title} (${parsed.year})`);

      console.time(`  ${parsed.title}`);

      const movieInfo = await getCachedOrSearchMovie(
        parsed.title,
        parsed.year,
        file,
        manualMatches,
        cache
      );

      // Obtener duración local del video
      const absolutePath = path.join(MOVIES_FOLDER, file);
      const localRuntime = await getVideoDuration(absolutePath);

      // Si NO hay información en TMDb, crear fallback
      if (!movieInfo) {
        console.warn(`📝 Usando fallback para: "${parsed.title}"`);
        const fallbackMovie = createFallbackMovie(parsed.title, parsed.year, file, parsed.title, parsed.year);
        console.timeEnd(`  ${parsed.title}`);
        return fallbackMovie;
      }

      // Validar que movieInfo tenga un ID válido
      if (!movieInfo.id) {
        console.error(`❌ ERROR CRÍTICO: movieInfo sin ID para "${parsed.title}"`);
        const fallbackMovie = createFallbackMovie(parsed.title, parsed.year, file, parsed.title, parsed.year);
        console.timeEnd(`  ${parsed.title}`);
        return fallbackMovie;
      }

      // Fetch Spanish localized data
      const movieES = await getMovieDetails(movieInfo.id);
      await new Promise(r => setTimeout(r, 100)); // Delay reducido

      // Selecciona y descarga el mejor poster
      let posterPath = null;
      if (movieInfo.poster_path) {
        posterPath = await selectAndDownloadPoster(movieInfo.id, movieInfo.poster_path, posterOverrides);
      }

      // Asegurar que SIEMPRE se crea un movieRecord válido
      const movieRecord = {
        title: movieES?.title ?? movieInfo.title,
        originalTitle: movieInfo.original_title,
        year: movieInfo.release_date?.split("-")[0] ?? parsed.year,
        overview: movieES?.overview ?? movieInfo.overview ?? "",
        originalOverview: movieInfo.overview ?? "",
        poster: posterPath,
        genres: transformGenres(movieES?.genres),
        tmdbId: movieInfo.id,
        runtime: movieInfo.runtime ?? localRuntime ?? null,
        sourceFile: file,
        parsedTitle: parsed.title,
        parsedYear: parsed.year
      };

      if (!movieRecord.runtime) {
        console.warn(`⚠️ Runtime missing: ${parsed.title}`);
      }

      console.log(`🎬 Match: "${parsed.title}" → "${movieRecord.title}"`);
      console.timeEnd(`  ${parsed.title}`);
      return movieRecord;
    },
    CONCURRENCY
  );

  // Combinar películas existentes con nuevas
  const existingOnly = moviesToProcess.filter(m => m.type === "existing").map(m => m.movie);
  const newOnly = processedNewMovies.filter(m => m !== null && m !== undefined);
  const finalMovies = [
    ...existingOnly,
    ...newOnly
  ];

  // Guardar resultados
  await fs.writeJson(OUTPUT_JSON, finalMovies, { spaces: 2 });
  await saveCache(cache);

  console.log(`\n✅ JSON generado con ${finalMovies.length} películas`);
  const fallbackCount = newOnly.filter(m => m.tmdbId === null).length;
  console.log(`   (${existingOnly.length} existentes + ${newOnly.length} nuevas${fallbackCount > 0 ? ` | ${fallbackCount} con fallback` : ""})`);
  console.timeEnd("Total");
}

main();