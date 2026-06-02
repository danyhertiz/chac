import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_KEY = '79babdd2d24b858c4488b987a2743aef';
const INPUT_JSON = path.join(__dirname, 'movies.json');
const MANUAL_MATCHES_JSON = path.join(__dirname, 'manualMatches.json');
const POSTERS_FOLDER = path.join(__dirname, '..', 'posters');
const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function safeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isMissingOverview(value) {
  const text = safeString(value);
  return text.length === 0 || /^no disponible$/iu.test(text);
}

function normalize(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchMovie(title, year) {
  try {
    const url =
      `https://api.themoviedb.org/3/search/movie` +
      `?api_key=${API_KEY}` +
      `&query=${encodeURIComponent(title)}` +
      `&primary_release_year=${encodeURIComponent(year)}` +
      `&language=es-MX`;

    const res = await fetch(url);
    const text = await res.text().catch(() => null);
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }

    if (!res.ok) {
      console.error(`❌ TMDb search error for "${title}" (${year}): ${res.status} ${res.statusText}`);
      return null;
    }

    if (!data || !Array.isArray(data.results) || data.results.length === 0) {
      return null;
    }

    return data.results[0];
  } catch (error) {
    console.error(`❌ Error buscando "${title}" (${year}):`, error?.message || error);
    return null;
  }
}

async function getMovieDetails(movieId) {
  return getTmdbDetails(movieId, 'movie');
}

async function getTvDetails(tvId) {
  return getTmdbDetails(tvId, 'tv');
}

async function getTmdbDetails(id, type = 'movie') {
  try {
    const endpoint = type === 'tv' ? 'tv' : 'movie';
    const url =
      `https://api.themoviedb.org/3/${endpoint}/${id}` +
      `?api_key=${API_KEY}` +
      `&language=es-MX`;

    const res = await fetch(url);
    const text = await res.text().catch(() => null);
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }

    if (!res.ok) {
      console.error(`❌ TMDb details error for ${type} ID ${id}: ${res.status} ${res.statusText}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`❌ Error obteniendo detalles TMDb para ID ${id}:`, error?.message || error);
    return null;
  }
}

async function downloadPoster(posterPath, tmdbId) {
  if (!posterPath) {
    return null;
  }

  await fs.ensureDir(POSTERS_FOLDER);

  const fileName = `${tmdbId}.jpg`;
  const localFilePath = path.join(POSTERS_FOLDER, fileName);
  const relativePath = `posters/${fileName}`;

  if (await fs.pathExists(localFilePath)) {
    return relativePath;
  }

  try {
    const response = await fetch(`${TMDB_POSTER_BASE_URL}${posterPath}`);
    if (!response.ok) {
      return null;
    }

    const buffer = await response.buffer();
    await fs.writeFile(localFilePath, buffer);
    return relativePath;
  } catch (error) {
    console.error(`❌ Error descargando poster TMDb ID ${tmdbId}:`, error?.message || error);
    return null;
  }
}

function safeNumber(value) {
  return typeof value === 'number' ? value : null;
}

function normalizeManualMatches(rawData) {
  const normalized = {};

  for (const [key, value] of Object.entries(rawData)) {
    if (key.startsWith('_')) continue;

    if (typeof value === 'number') {
      normalized[normalize(key)] = { id: value, type: 'movie' };
      continue;
    }

    if (typeof value === 'object' && value && value.id) {
      const tmdbId = Number(value.id);
      if (!Number.isInteger(tmdbId) || tmdbId <= 0) continue;
      normalized[normalize(key)] = {
        id: tmdbId,
        type: value.type === 'tv' ? 'tv' : 'movie'
      };
    }
  }

  return normalized;
}

async function loadManualMatches() {
  try {
    if (await fs.pathExists(MANUAL_MATCHES_JSON)) {
      const rawData = await fs.readJson(MANUAL_MATCHES_JSON);
      return normalizeManualMatches(rawData);
    }
  } catch (error) {
    console.warn(`⚠️ Error leyendo manualMatches.json:`, error?.message || error);
  }

  return {};
}

function formatMovieLine(movie) {
  return `${safeString(movie.title) || safeString(movie.originalTitle) || '<sin título>'} (${safeString(movie.year) || '????'})`;
}

async function fillMissingData() {
  if (!await fs.pathExists(INPUT_JSON)) {
    console.error(`❌ No existe ${INPUT_JSON}`);
    return;
  }

  const movies = await fs.readJson(INPUT_JSON);
  if (!Array.isArray(movies)) {
    console.error('❌ movies.json debe ser un arreglo');
    return;
  }

  const manualMatches = await loadManualMatches();
  const pending = movies.filter(movie => movie.tmdbId == null);
  console.log(`📍 Películas con tmdbId vacío: ${pending.length}`);
  console.log(`🛠️ Manual matches cargados: ${Object.keys(manualMatches).length}`);

  let updatedCount = 0;
  let searchedCount = 0;

  for (const movie of pending) {
    const title = safeString(movie.title) || safeString(movie.originalTitle) || safeString(movie.parsedTitle);
    const year = safeString(movie.year) || safeString(movie.parsedYear);

    if (!title || !year) {
      console.log(`⚠️ Omitida por falta de título o año: ${formatMovieLine(movie)}`);
      continue;
    }

    const normalizedTitle = normalize(title);
    const manualEntry = manualMatches[normalizedTitle];

    let details = null;
    let resolvedId = null;
    let resolvedType = 'movie';

    if (manualEntry) {
      resolvedId = manualEntry.id;
      resolvedType = manualEntry.type || 'movie';
      console.log(`🔧 Usando manualMatches para: ${title} (${year}) -> ${resolvedType} ID ${resolvedId}`);
    } else {
      searchedCount += 1;
      console.log(`🔎 Buscando TMDb para: ${title} (${year})`);
      const basicMovie = await searchMovie(title, year);
      if (!basicMovie) {
        console.log(`❌ Sin match TMDb: ${title} (${year})`);
        continue;
      }
      resolvedId = basicMovie.id;
      details = await getMovieDetails(basicMovie.id);
      if (!details) {
        console.log(`❌ No se pudieron obtener detalles de TMDb para ID ${basicMovie.id}`);
        continue;
      }
    }

    if (!details) {
      if (resolvedType === 'tv') {
        details = await getTvDetails(resolvedId);
      } else {
        details = await getMovieDetails(resolvedId);
      }
      if (!details) {
        console.log(`❌ No se pudieron obtener detalles de TMDb para ID ${resolvedId}`);
        continue;
      }
    }

    const posterPath = await downloadPoster(details.poster_path, resolvedId);
    const titleField = resolvedType === 'tv' ? details.name : details.title;
    const originalTitleField = resolvedType === 'tv' ? details.original_name : details.original_title;
    const releaseDateField = resolvedType === 'tv' ? details.first_air_date : details.release_date;
    const runtimeField = resolvedType === 'tv'
      ? Array.isArray(details.episode_run_time) && details.episode_run_time.length > 0
        ? details.episode_run_time[0]
        : null
      : safeNumber(details.runtime);

    let changed = false;
    const changes = [];

    if (movie.tmdbId == null) {
      movie.tmdbId = resolvedId;
      changed = true;
      changes.push('tmdbId');
    }

    if (!movie.poster && posterPath) {
      movie.poster = posterPath;
      changed = true;
      changes.push('poster');
    }

    if (isMissingOverview(movie.overview) && safeString(details.overview).length > 0) {
      movie.overview = details.overview;
      changed = true;
      changes.push('overview');
    }

    if (!safeString(movie.originalOverview) && safeString(details.overview).length > 0) {
      movie.originalOverview = details.overview;
      changed = true;
      changes.push('originalOverview');
    }

    if ((!Array.isArray(movie.genres) || movie.genres.length === 0) && Array.isArray(details.genres) && details.genres.length > 0) {
      movie.genres = details.genres.map((g) => g.name);
      changed = true;
      changes.push('genres');
    }

    if (movie.runtime == null && safeNumber(runtimeField) != null) {
      movie.runtime = runtimeField;
      changed = true;
      changes.push('runtime');
    }

    if (!safeString(movie.originalTitle) && safeString(originalTitleField).length > 0) {
      movie.originalTitle = originalTitleField;
      changed = true;
      changes.push('originalTitle');
    }

    if (!safeString(movie.title) && safeString(titleField).length > 0) {
      movie.title = titleField;
      changed = true;
      changes.push('title');
    }

    if (!safeString(movie.year) && safeString(releaseDateField).length >= 4) {
      movie.year = releaseDateField.split('-')[0];
      changed = true;
      changes.push('year');
    }

    if (changed) {
      updatedCount += 1;
      console.log(`✅ Actualizada: ${formatMovieLine(movie)} -> campos: ${changes.join(', ')}`);
    } else {
      console.log(`ℹ️ No se llenó ningún campo nuevo para: ${formatMovieLine(movie)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  if (updatedCount === 0) {
    console.log('✅ No se actualizaron registros');
    return;
  }

  await fs.writeJson(INPUT_JSON, movies, { spaces: 2 });
  console.log(`
✅ ${updatedCount} películas actualizadas`);
  console.log(`📚 Total de películas procesadas: ${searchedCount}`);
}

fillMissingData();
