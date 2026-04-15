import fs from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_KEY = "79babdd2d24b858c4488b987a2743aef";
const MOVIES_FOLDER = "D:/Videos/Peliculas/HD"; // carpeta donde están tus videos
const OUTPUT_JSON = "./movies.json";
const POSTERS_FOLDER = path.join(__dirname, "..", "posters");
const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

function parseFileName(fileName) {
  // Ejemplo: "The Matrix (1999).mp4"
  const match = fileName.match(/^(.*)\((\d{4})\)/);
  if (!match) return null;

  return {
    title: match[1].trim(),
    year: match[2]
  };
}

async function searchMovie(title, year) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(title)}&year=${year}`;
  
  const res = await fetch(url);
  const data = await res.json();

  return data.results?.[0] || null;
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
  await initializePostersFolder();

  const files = await fs.readdir(MOVIES_FOLDER);

  const movies = [];

  for (const file of files) {
    if (!file.endsWith(".mp4") && !file.endsWith(".mkv")) continue;

    const parsed = parseFileName(file);
    if (!parsed) {
      console.log(`❌ No se pudo parsear: ${file}`);
      continue;
    }

    console.log(`🔎 Buscando: ${parsed.title} (${parsed.year})`);

    const movieData = await searchMovie(parsed.title, parsed.year);

    if (!movieData) {
      console.log(`⚠️ No encontrada: ${parsed.title}`);
      continue;
    }

    // Increase delay to respect API rate limits
    await new Promise(r => setTimeout(r, 350));

    // Fetch Spanish localized data
    const movieES = await getMovieDetails(movieData.id);

    // Descarga el poster si existe
    let posterPath = null;
    if (movieData.poster_path) {
      posterPath = await downloadPoster(movieData.poster_path, movieData.id);
    }

    movies.push({
      title: movieES?.title ?? movieData.title,
      originalTitle: movieData.original_title,
      year: movieData.release_date?.split("-")[0],
      overview: movieES?.overview ?? movieData.overview,
      originalOverview: movieData.overview,
      poster: posterPath,
      genres: transformGenres(movieES?.genres),
      tmdbId: movieData.id
    });

    // Increase delay between API calls to avoid rate limiting
    await new Promise(r => setTimeout(r, 350));
  }

  await fs.writeJson(OUTPUT_JSON, movies, { spaces: 2 });

  console.log(`✅ JSON generado con ${movies.length} películas`);
}

main();