import fs from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants EXACTLY as they exist in generateMovies.mjs
const API_KEY = "79babdd2d24b858c4488b987a2743aef";
const MOVIES_FOLDER = "D:/Videos/Peliculas/HD";
const OUTPUT_JSON = "./movies.json";
const MANUAL_MATCHES_JSON = "./manualMatches.json";
const CACHE_JSON = "./cache.json";
const POSTER_OVERRIDES_JSON = "./posterOverrides.json";
const POSTERS_FOLDER = path.join(__dirname, "..", "posters");
const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const CONCURRENCY = 5;

/**
 * Normaliza texto para comparación
 */
function normalize(text) {
  if (!text) return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Calcula similitud entre dos strings
 */
function similarity(a, b) {
  if (!a || !b) return 0;
  const normA = normalize(a);
  const normB = normalize(b);
  if (normA === normB) return 1;
  const wordsA = normA.split(" ").filter(w => w.length > 0);
  const wordsB = normB.split(" ").filter(w => w.length > 0);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  const common = wordsA.filter(w => wordsB.includes(w));
  const ratio = common.length / Math.max(wordsA.length, wordsB.length);
  if (ratio >= 1) return 1;
  if (ratio > 0.6) return 0.8;
  if (ratio > 0.4) return 0.5;
  return 0;
}

/**
 * Limpia el título de forma agresiva
 */
function cleanTitleAggressively(title) {
  if (!title) return "";
  return title.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/\d{3,4}p|bluray|hdtv|x264|h264|ac3|dts|brrip|web-dl|dual|latino|spanish/gi, "").replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parsea nombre de archivo
 */
function parseFileName(fileName) {
  const match = fileName.match(/^(.*)\((\d{4})\)/);
  if (!match) return null;
  return { title: match[1].trim(), year: match[2] };
}

/**
 * Obtiene duración del video
 */
async function getVideoDuration(filePath) {
  try {
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const durationSeconds = parseFloat(execSync(command, { encoding: "utf-8" }).trim());
    return isNaN(durationSeconds) ? null : Math.round(durationSeconds / 60);
  } catch (error) { return null; }
}

/**
 * Fetch detailed movie data
 */
async function getMovieDetails(movieId) {
  const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=es-MX`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data || null;
  } catch (error) { return null; }
}

/**
 * Obtiene imágenes
 */
async function getMovieImages(movieId) {
  const url = `https://api.themoviedb.org/3/movie/${movieId}/images?api_key=${API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.posters || [];
  } catch (error) { return null; }
}

/**
 * Selecciona el mejor poster
 */
function selectBestPoster(posters) {
  if (!Array.isArray(posters) || posters.length === 0) return null;
  const spanishPosters = posters.filter(p => p.iso_639_1 === "es");
  const nullLanguagePosters = posters.filter(p => p.iso_639_1 === null);
  const otherPosters = posters.filter(p => p.iso_639_1 !== "es" && p.iso_639_1 !== null);
  const sortPosters = (arr) => arr.sort((a, b) => (a.vote_average !== b.vote_average) ? b.vote_average - a.vote_average : (a.vote_count !== b.vote_count) ? b.vote_count - a.vote_count : b.width - a.width);
  if (spanishPosters.length > 0) return sortPosters(spanishPosters)[0];
  if (nullLanguagePosters.length > 0) return sortPosters(nullLanguagePosters)[0];
  if (otherPosters.length > 0) return sortPosters(otherPosters)[0];
  return null;
}

/**
 * Descarga poster
 */
async function downloadPoster(posterPath, tmdbId) {
  if (!posterPath) return null;
  const fileName = `${tmdbId}.jpg`;
  const localFilePath = path.join(POSTERS_FOLDER, fileName);
  const relativePath = `posters/${fileName}`;
  if (await fs.pathExists(localFilePath)) return relativePath;
  try {
    const response = await fetch(`${TMDB_POSTER_BASE_URL}${posterPath}`);
    if (!response.ok) return null;
    const buffer = await response.buffer();
    await fs.writeFile(localFilePath, buffer);
    return relativePath;
  } catch (error) { return null; }
}

/**
 * Selecciona y descarga poster con lógica de overrides
 */
async function selectAndDownloadPoster(movieId, originalPosterPath, posterOverrides) {
  if (posterOverrides[movieId]) return posterOverrides[movieId];
  try {
    const allPosters = await getMovieImages(movieId);
    const bestPoster = selectBestPoster(allPosters);
    return await downloadPoster(bestPoster?.file_path || originalPosterPath, movieId);
  } catch (error) {
    return await downloadPoster(originalPosterPath, movieId);
  }
}

/**
 * Busca película con validación de runtime y estrategias de recuperación
 */
async function searchMovie(title, year, localRuntime, manualMatches) {
  // Check Manual Matches First
  const normalizedTitle = normalize(title);
  const manualEntry = manualMatches[normalizedTitle];
  if (manualEntry) {
    const { id, type } = manualEntry;
    try {
      const data = await getMovieDetails(id);
      if (data && data.id) return { ...data, title: data.title || data.name, original_title: data.original_title || data.original_name, release_date: data.release_date || data.first_air_date, runtime: data.runtime || data.episode_run_time?.[0] || null };
    } catch (e) {}
  }

  // Strategies: 1. With year, 2. Without year, 3. Cleaned title, 4. Partial title
  const strategies = [
    { url: `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(title)}&primary_release_year=${year}&language=es-MX`, label: "with year" },
    { url: `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(title)}&language=es-MX`, label: "without year" },
    { url: `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(cleanTitleAggressively(title))}&language=es-MX`, label: "cleaned title" }
  ];

  for (const strategy of strategies) {
    try {
      const res = await fetch(strategy.url);
      const data = await res.json();
      const results = data.results || [];
      if (results.length > 0) {
        const bestMatch = await findBestMatchWithRuntime(results, title, year, localRuntime, true);
        if (bestMatch) return bestMatch;
      }
    } catch (e) {}
  }
  return null;
}

async function findBestMatchWithRuntime(results, fileTitle, year, localRuntime, isEnhanced = false) {
  if (!results || results.length === 0) return null;
  const scoredResults = results.map(movie => {
    let score = similarity(fileTitle, movie.title) * 2 + similarity(fileTitle, movie.original_title) * 2;
    if (year && movie.release_date && movie.release_date.startsWith(year)) score += 1.5;
    else if (isEnhanced && year && movie.release_date && Math.abs(parseInt(movie.release_date.split("-")[0]) - parseInt(year)) <= 1) score += 1.0;
    if (movie.popularity) score += Math.min(movie.popularity / 50, 1);
    if (movie.genre_ids && movie.genre_ids.includes(99)) score -= 2;
    return { movie, score };
  }).sort((a, b) => b.score - a.score);

  const topCandidates = scoredResults.slice(0, 10);
  for (const candidate of topCandidates) {
    const detailed = await getMovieDetails(candidate.movie.id);
    if (detailed) {
      const tmdbRuntime = detailed.runtime || detailed.episode_run_time?.[0] || null;
      if (localRuntime && tmdbRuntime && Math.abs(localRuntime - tmdbRuntime) <= 10) candidate.score += (Math.abs(localRuntime - tmdbRuntime) <= 5 ? 2 : 1);
      candidate.movie.runtime = tmdbRuntime;
    }
  }
  const bestMatch = topCandidates.sort((a, b) => b.score - a.score)[0];
  return bestMatch.score >= 1.0 ? bestMatch.movie : null;
}

/**
 * Main script function
 */
async function updateNewMovies() {
  console.time("Execution Time");
  try {
    if (!await fs.pathExists(OUTPUT_JSON)) { console.error("❌ movies.json not found."); return; }

    const existingMovies = await fs.readJson(OUTPUT_JSON);
    console.log(`📦 Existing movies: ${existingMovies.length}`);

    const existingFiles = new Set(existingMovies.map(m => m.sourceFile));
    const allFiles = await fs.readdir(MOVIES_FOLDER);
    const videoFiles = allFiles.filter(f => [".mp4", ".mkv", ".avi"].includes(path.extname(f).toLowerCase()));
    const newFiles = videoFiles.filter(file => !existingFiles.has(file));

    console.log(`🆕 New files detected: ${newFiles.length}`);
    if (newFiles.length === 0) { console.log("✅ No new movies found. No changes made."); return; }

    // Load helpers data
    const cache = await fs.readJson(CACHE_JSON).catch(() => ({}));
    const manualMatchesRaw = await fs.readJson(MANUAL_MATCHES_JSON).catch(() => ({}));
    const manualMatches = {};
    Object.entries(manualMatchesRaw).forEach(([k, v]) => { if(!k.startsWith("_")) manualMatches[normalize(k)] = typeof v === "number" ? {id: v, type: "movie"} : v; });
    const posterOverrides = await fs.readJson(POSTER_OVERRIDES_JSON).catch(() => ({}));

    const addedMovies = [];
    for (const file of newFiles) {
      console.log(`🔎 Processing: ${file}`);
      const parsed = parseFileName(file);
      if (!parsed) { console.log(`   ❌ Could not parse filename.`); continue; }

      const localRuntime = await getVideoDuration(path.join(MOVIES_FOLDER, file));
      const movieInfo = await searchMovie(parsed.title, parsed.year, localRuntime, manualMatches);

      if (!movieInfo) {
        console.log(`   ⚠️ No TMDb match found. Adding fallback.`);
        addedMovies.push({ title: parsed.title, originalTitle: parsed.title, year: parsed.year, overview: "No disponible", originalOverview: "", poster: null, genres: [], tmdbId: null, runtime: localRuntime, sourceFile: file, parsedTitle: parsed.title, parsedYear: parsed.year });
        continue;
      }

      const movieES = await getMovieDetails(movieInfo.id);
      const posterPath = await selectAndDownloadPoster(movieInfo.id, movieInfo.poster_path, posterOverrides);

      const movieObject = {
        title: movieES?.title || movieInfo.title,
        originalTitle: movieInfo.original_title,
        year: movieInfo.release_date?.split("-")[0] || parsed.year,
        overview: movieES?.overview || movieInfo.overview || "",
        originalOverview: movieInfo.overview || "",
        poster: posterPath,
        genres: (movieES?.genres || []).map(g => g.name),
        tmdbId: movieInfo.id,
        runtime: movieInfo.runtime || localRuntime || null,
        sourceFile: file,
        parsedTitle: parsed.title,
        parsedYear: parsed.year
      };

      addedMovies.push(movieObject);
      console.log(`   ➕ Added: ${movieObject.title}`);
      await new Promise(r => setTimeout(r, 100)); // Respect rate limit
    }

    if (addedMovies.length > 0) {
      const finalMovies = [...existingMovies, ...addedMovies];
      await fs.writeJson(OUTPUT_JSON, finalMovies, { spaces: 2 });
      console.log(`\n✅ Success! Added ${addedMovies.length} new movies.`);
    }

  } catch (error) {
    console.error("❌ Critical error:", error.message);
  }
  console.timeEnd("Execution Time");
}

updateNewMovies();
