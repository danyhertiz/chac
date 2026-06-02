import fs from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_KEY = "79babdd2d24b858c4488b987a2743aef";
const MOVIES_FOLDER = "D:/Videos/Peliculas/HD";

const OUTPUT_JSON = "./movies.json";
const POSTERS_FOLDER = path.join(__dirname, "..", "posters");

const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

console.log(`TMDb API key: ${API_KEY ? "present" : "MISSING - set API_KEY"}`);

function normalize(text) {
  if (!text) return "";

  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFileName(fileName) {
  const match = fileName.match(/^(.*)\((\d{4})\)/);

  if (!match) return null;

  return {
    title: match[1].trim(),
    year: match[2]
  };
}

async function searchMovie(title, year) {
  try {
    const url =
      `https://api.themoviedb.org/3/search/movie` +
      `?api_key=${API_KEY}` +
      `&query=${encodeURIComponent(title)}` +
      `&primary_release_year=${year}` +
      `&language=es-MX`;

    const res = await fetch(url);

    // leer cuerpo de forma segura para diagnosticar errores
    const text = await res.text().catch(() => null);
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      console.error(
        `❌ TMDb search error for "${title}" -> ${res.status} ${res.statusText}: ${
          (data && data.status_message) || text || "no body"
        }`
      );
      return null;
    }

    if (!data || !data.results || data.results.length === 0) {
      return null;
    }

    return data.results[0];

  } catch (error) {
    console.error(`❌ Error buscando "${title}"`);
    return null;
  }
}

async function getMovieDetails(movieId) {
  try {
    const url =
      `https://api.themoviedb.org/3/movie/${movieId}` +
      `?api_key=${API_KEY}` +
      `&language=es-MX`;

    const res = await fetch(url);

    const text = await res.text().catch(() => null);
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      console.error(
        `❌ TMDb details error for ID ${movieId} -> ${res.status} ${res.statusText}: ${
          (data && data.status_message) || text || "no body"
        }`
      );
      return null;
    }

    return data;

  } catch (error) {
    return null;
  }
}

async function downloadPoster(posterPath, tmdbId) {
  if (!posterPath) {
    console.log(`⚠️ Sin poster disponible para TMDb ID ${tmdbId}`);
    return null;
  }

  await fs.ensureDir(POSTERS_FOLDER);

  const fileName = `${tmdbId}.jpg`;

  const localFilePath = path.join(POSTERS_FOLDER, fileName);

  const relativePath = `posters/${fileName}`;

  // NO volver a descargar si ya existe
  if (await fs.pathExists(localFilePath)) {
    return relativePath;
  }

  try {
    console.log(`⬇️ Descargando poster: ${fileName}`);

    const response = await fetch(
      `${TMDB_POSTER_BASE_URL}${posterPath}`
    );

    if (!response.ok) {
      return null;
    }

    const buffer = await response.buffer();

    await fs.writeFile(localFilePath, buffer);

    return relativePath;

  } catch (error) {
    return null;
  }
}

async function updateCatalog() {

  // =========================================
  // CARGAR JSON EXISTENTE
  // =========================================

  if (!await fs.pathExists(OUTPUT_JSON)) {
    console.error("❌ movies.json no existe");
    return;
  }

  const existingMovies = await fs.readJson(OUTPUT_JSON);

  console.log(`📚 Películas existentes: ${existingMovies.length}`);

  // =========================================
  // MAPAS PARA DETECCIÓN RÁPIDA
  // =========================================

  const existingSourceFiles = new Set(
    existingMovies.map(m => m.sourceFile)
  );

  // Evitar duplicados por título+año
  const existingMovieKeys = new Set(
    existingMovies.map(m =>
      `${normalize(m.parsedTitle || m.title)}_${m.year}`
    )
  );

  // =========================================
  // ESCANEAR ARCHIVOS
  // =========================================

  const files = await fs.readdir(MOVIES_FOLDER);

  const videoFiles = files.filter(file =>
    [".mp4", ".mkv", ".avi"].includes(
      path.extname(file).toLowerCase()
    )
  );

  console.log(`📁 Archivos encontrados: ${videoFiles.length}`);

  const newMovies = [];

  for (const file of videoFiles) {

    // =========================================
    // IGNORAR SI YA EXISTE EXACTAMENTE
    // =========================================

    if (existingSourceFiles.has(file)) {
      continue;
    }

    const parsed = parseFileName(file);

    if (!parsed) {
      console.log(`⚠️ No se pudo parsear: ${file}`);
      continue;
    }

    // =========================================
    // EVITAR DUPLICADOS POR TÍTULO+AÑO
    // =========================================

    const movieKey =
      `${normalize(parsed.title)}_${parsed.year}`;

    if (existingMovieKeys.has(movieKey)) {
      console.log(`⏭️ Duplicado ignorado: ${file}`);
      continue;
    }

    console.log(`🔎 Nueva película: ${parsed.title}`);

    // =========================================
    // BUSCAR EN TMDB
    // =========================================

    const basicMovie = await searchMovie(
      parsed.title,
      parsed.year
    );

    // =========================================
    // FALLBACK SI NO HAY MATCH
    // =========================================

    if (!basicMovie) {
      console.log(`⚠️ Sin match TMDb, no se creará entrada: ${parsed.title} (${parsed.year})`);
      continue;
    }

    // =========================================
    // DETALLES COMPLETOS
    // =========================================

    const details = await getMovieDetails(
      basicMovie.id
    );

    const bestPosterPath =
      details?.poster_path ||
      basicMovie.poster_path ||
      null;

    const posterPath = await downloadPoster(
      bestPosterPath,
      basicMovie.id
    );

    const movieObject = {
      title: details?.title || basicMovie.title,
      originalTitle:
        basicMovie.original_title || basicMovie.title,

      year:
        basicMovie.release_date?.split("-")[0]
        || parsed.year,

      overview:
        details?.overview
        || basicMovie.overview
        || "",

      originalOverview:
        basicMovie.overview || "",

      poster: posterPath,

      genres:
        details?.genres?.map(g => g.name) || [],

      tmdbId: basicMovie.id,

      runtime:
        details?.runtime || null,

      sourceFile: file,

      parsedTitle: parsed.title,

      parsedYear: parsed.year
    };

    newMovies.push(movieObject);

    existingMovieKeys.add(movieKey);

    console.log(`➕ Agregada: ${movieObject.title}`);

    // pequeña pausa TMDb
    await new Promise(r => setTimeout(r, 150));
  }

  // =========================================
  // GUARDAR SOLO SI HAY CAMBIOS
  // =========================================

  if (newMovies.length === 0) {

    console.log("✅ No hay películas nuevas");

    return;
  }

  const finalMovies = [
    ...existingMovies,
    ...newMovies
  ];

  await fs.writeJson(
    OUTPUT_JSON,
    finalMovies,
    { spaces: 2 }
  );

  console.log(`\n✅ ${newMovies.length} películas agregadas`);
  console.log(`📚 Total: ${finalMovies.length}`);
}

updateCatalog();