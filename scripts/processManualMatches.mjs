import fs from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants EXACTLY as they exist in generateMovies.mjs
const API_KEY = "79babdd2d24b858c4488b987a2743aef";
const OUTPUT_JSON = "./movies.json";
const MANUAL_MATCHES_JSON = "./manualMatches.json";
const POSTERS_FOLDER = path.join(__dirname, "..", "posters");
const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

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
 * Descarga el poster si no existe
 * Reuse existing poster logic from generateMovies.mjs
 */
async function downloadPoster(posterPath, tmdbId) {
  if (!posterPath) {
    return null;
  }

  const fileName = `${tmdbId}.jpg`;
  const localFilePath = path.join(POSTERS_FOLDER, fileName);
  const relativePath = `posters/${fileName}`;

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

    // Node-fetch v3 compatibility for buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(localFilePath, buffer);
    
    console.log(`✅ Poster guardado: ${fileName}`);
    return relativePath;
  } catch (error) {
    console.error(`❌ Error al descargar poster ${fileName}:`, error.message);
    return null;
  }
}

/**
 * Transform genres array to names
 */
function transformGenres(genresArray) {
  if (!genresArray || !Array.isArray(genresArray)) {
    return [];
  }
  return genresArray.map(genre => genre.name);
}

async function processManualMatches() {
  try {
    // 0️⃣ PREPARE
    await fs.ensureDir(POSTERS_FOLDER);

    // 1️⃣ LOAD DATA
    if (!await fs.pathExists(OUTPUT_JSON)) {
      console.error(`❌ ${OUTPUT_JSON} not found.`);
      return;
    }
    if (!await fs.pathExists(MANUAL_MATCHES_JSON)) {
      console.error(`❌ ${MANUAL_MATCHES_JSON} not found.`);
      return;
    }

    const existingMovies = await fs.readJson(OUTPUT_JSON);
    const manualMatchesRaw = await fs.readJson(MANUAL_MATCHES_JSON);

    // Filter out keys starting with "_" (comments)
    const manualMatches = Object.entries(manualMatchesRaw).filter(([key]) => !key.startsWith("_"));

    console.log(`🚀 Processing ${manualMatches.length} manual matches from ${MANUAL_MATCHES_JSON}...`);

    for (const [key, value] of manualMatches) {
      const normalizedKey = normalize(key);
      let tmdbId, type;

      // Handle both formats: "key": id or "key": { id, type }
      if (typeof value === "object") {
        tmdbId = value.id;
        type = value.type || "movie";
      } else {
        tmdbId = value;
        type = "movie";
      }

      console.log(`🔧 Processing manual match: "${key}" (tmdbId: ${tmdbId}, type: ${type})`);

      // 2️⃣ FETCH FROM TMDB (NO SEARCH)
      const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${API_KEY}&language=es-MX`;
      const res = await fetch(url);

      if (!res.ok) {
        console.error(`❌ Error fetching ${type} ${tmdbId}: ${res.status} ${res.statusText}`);
        continue;
      }

      const data = await res.json();

      // 3️⃣ BUILD MOVIE OBJECT
      const movieObject = {
        title: data.title || data.name,
        originalTitle: data.original_title || data.original_name,
        year: (data.release_date || data.first_air_date || "").split("-")[0],
        overview: data.overview || "",
        originalOverview: data.overview || "", // Mirror generateMovies.mjs basic behavior
        poster: await downloadPoster(data.poster_path, tmdbId),
        genres: transformGenres(data.genres),
        tmdbId: data.id,
        runtime: data.runtime || (data.episode_run_time ? data.episode_run_time[0] : null) || null
      };

      // 4️⃣ UPDATE OR INSERT
      // Find by tmdbId (preferred) or normalized title
      let index = existingMovies.findIndex(m => m.tmdbId === tmdbId);
      
      if (index === -1) {
        index = existingMovies.findIndex(m => 
          normalize(m.title) === normalizedKey || 
          (m.parsedTitle && normalize(m.parsedTitle) === normalizedKey)
        );
      }

      if (index !== -1) {
        console.log(`🔁 Updating existing: ${movieObject.title}`);
        const existing = existingMovies[index];
        
        // Update only missing or incorrect fields as per instructions
        existingMovies[index] = {
          ...existing,
          title: movieObject.title || existing.title,
          originalTitle: movieObject.originalTitle || existing.originalTitle,
          year: movieObject.year || existing.year,
          overview: movieObject.overview || existing.overview,
          originalOverview: movieObject.originalOverview || existing.originalOverview,
          poster: movieObject.poster || existing.poster,
          genres: movieObject.genres.length > 0 ? movieObject.genres : existing.genres,
          tmdbId: movieObject.tmdbId || existing.tmdbId,
          runtime: movieObject.runtime || existing.runtime
        };
      } else {
        console.log(`➕ Adding new: ${movieObject.title}`);
        existingMovies.push(movieObject);
      }
      
      // Delay to respect rate limit (100ms as in generateMovies.mjs)
      await new Promise(r => setTimeout(r, 100));
    }

    // 5️⃣ SAVE RESULT
    await fs.writeJson(OUTPUT_JSON, existingMovies, { spaces: 2 });
    console.log(`\n✅ Finished! ${OUTPUT_JSON} has been updated.`);

  } catch (error) {
    console.error(`\n❌ Critical error:`, error.message);
  }
}

processManualMatches();
