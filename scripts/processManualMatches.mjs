import fs from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants EXACTLY as they exist in generateMovies.mjs
const API_KEY = "79babdd2d24b858c4488b987a2743aef";
const OUTPUT_JSON = path.join(__dirname, "movies.json");
const MANUAL_MATCHES_JSON = path.join(__dirname, "manualMatches.json");
const POSTERS_FOLDER = path.join(__dirname, "..", "img", "posters");
const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const normalizeId = (tmdbId) => tmdbId === undefined || tmdbId === null ? "" : String(tmdbId);

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
  const relativePath = `img/posters/${fileName}`;

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

function getMatchDetails(value) {
  if (typeof value === "object" && value !== null) {
    return { tmdbId: value.id, type: value.type || "movie" };
  }
  return { tmdbId: value, type: "movie" };
}

function getBackupPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${OUTPUT_JSON}.${timestamp}.bak`;
}

async function validateTemporaryFile(filePath, originalMovies, addedCount) {
  const savedMovies = await fs.readJson(filePath);
  if (!Array.isArray(savedMovies) || savedMovies.length !== originalMovies.length + addedCount) {
    throw new Error("La validacion fallo: cambio inesperadamente el numero de peliculas.");
  }
  if (JSON.stringify(savedMovies.slice(0, originalMovies.length)) !== JSON.stringify(originalMovies)) {
    throw new Error("La validacion fallo: se modificaron peliculas que ya existian.");
  }

  const ids = savedMovies.map(movie => normalizeId(movie.tmdbId));
  if (ids.slice(originalMovies.length).some(id => !id)
      || new Set(ids.filter(Boolean)).size !== ids.filter(Boolean).length) {
    throw new Error("La validacion fallo: los nuevos tmdbId deben existir y ser unicos.");
  }
}

async function processManualMatches() {
  if (!await fs.pathExists(OUTPUT_JSON)) {
    throw new Error(`No se encontro ${OUTPUT_JSON}.`);
  }
  if (!await fs.pathExists(MANUAL_MATCHES_JSON)) {
    throw new Error(`No se encontro ${MANUAL_MATCHES_JSON}.`);
  }

  const existingMovies = await fs.readJson(OUTPUT_JSON);
  const manualMatchesRaw = await fs.readJson(MANUAL_MATCHES_JSON);
  if (!Array.isArray(existingMovies)) {
    throw new Error("movies.json debe contener un arreglo de peliculas.");
  }
  if (!manualMatchesRaw || typeof manualMatchesRaw !== "object" || Array.isArray(manualMatchesRaw)) {
    throw new Error("manualMatches.json debe contener un objeto de correspondencias.");
  }

  const existingIds = new Set(existingMovies.map(movie => normalizeId(movie.tmdbId)).filter(Boolean));
  const manualMatches = Object.entries(manualMatchesRaw).filter(([key]) => !key.startsWith("_"));
  let addedCount = 0;

  await fs.ensureDir(POSTERS_FOLDER);
  console.log(`🚀 Processing ${manualMatches.length} manual matches from ${MANUAL_MATCHES_JSON}...`);

  for (const [key, value] of manualMatches) {
    const { tmdbId, type } = getMatchDetails(value);
    const normalizedId = normalizeId(tmdbId);
    if (!normalizedId) {
      console.warn(`⚠️ No TMDB ID for "${key}", skipping.`);
      continue;
    }

    if (existingIds.has(normalizedId)) {
      console.log(`⏭️ ID ${normalizedId} already exists; keeping its data unchanged.`);
      continue;
    }

    console.log(`🔧 Processing manual match: "${key}" (tmdbId: ${normalizedId}, type: ${type})`);

    try {
      const query = new URLSearchParams({ api_key: API_KEY, language: "es-MX" });
      const url = `https://api.themoviedb.org/3/${type}/${encodeURIComponent(normalizedId)}?${query}`;
      const res = await fetch(url);

      if (!res.ok) {
        console.error(`❌ Error fetching ${type} ${normalizedId}: ${res.status} ${res.statusText}`);
        continue;
      }

      const data = await res.json();
      if (normalizeId(data.id) !== normalizedId) {
        console.error(`❌ TMDB returned an unexpected ID for ${type}/${normalizedId}; skipping.`);
        continue;
      }

      const movieObject = {
        title: data.title || data.name,
        originalTitle: data.original_title || data.original_name,
        year: (data.release_date || data.first_air_date || "").split("-")[0],
        overview: data.overview || "",
        originalOverview: data.overview || "",
        poster: await downloadPoster(data.poster_path, normalizedId),
        genres: transformGenres(data.genres),
        tmdbId: data.id,
        runtime: data.runtime || (data.episode_run_time ? data.episode_run_time[0] : null) || null
      };

      existingMovies.push(movieObject);
      existingIds.add(normalizedId);
      addedCount += 1;
      console.log(`➕ Added: ${movieObject.title}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ Error processing ${type}/${normalizedId}:`, error.message);
    }
  }

  if (addedCount === 0) {
    console.log("\n✅ No new movies to add; the catalog was not changed.");
    return;
  }

  const temporaryFile = `${OUTPUT_JSON}.tmp`;
  await fs.writeJson(temporaryFile, existingMovies, { spaces: 2 });
  await validateTemporaryFile(temporaryFile, await fs.readJson(OUTPUT_JSON), addedCount);
  const backupFile = getBackupPath();
  await fs.copyFile(OUTPUT_JSON, backupFile);
  await fs.rename(temporaryFile, OUTPUT_JSON);
  console.log(`Copia de seguridad: ${backupFile}`);
  console.log(`\n✅ Finished! Added ${addedCount} new movie(s) to ${OUTPUT_JSON}.`);
}

processManualMatches().catch(error => {
  console.error("\n❌ Critical error:", error.message);
  process.exitCode = 1;
});
