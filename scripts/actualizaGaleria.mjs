import fs from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MOVIES_JSON = path.join(__dirname, "movies.json");
const MANUAL_MATCHES_JSON = path.join(__dirname, "manualMatches.json");
const API_KEY = process.env.TMDB_API_KEY || "79babdd2d24b858c4488b987a2743aef";
const LANGUAGE = "es-MX";
const DELAY_MS = 250;
const forceUpdate = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function normalizeId(tmdbId) {
    return tmdbId === undefined || tmdbId === null ? "" : String(tmdbId);
}

function isValidRuntime(value) {
    return Number.isInteger(value) && value > 0;
}

function isValidReleaseDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getBackupPath() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${MOVIES_JSON}.${timestamp}.bak`;
}

function getManualMatches(manualMatches) {
    return Object.entries(manualMatches).filter(([key]) => !key.startsWith("_"));
}

function getMatchDetails(value) {
    if (typeof value === "object" && value !== null) {
        return { tmdbId: value.id, type: value.type || "movie" };
    }
    return { tmdbId: value, type: "movie" };
}

function getReleaseDate(data, type) {
    return type === "tv" ? data.first_air_date : data.release_date;
}

function getRuntime(data, type) {
    return data.runtime || (type === "tv" ? data.episode_run_time?.[0] : null) || null;
}

function buildMovieData(data, type, poster) {
    const releaseDate = getReleaseDate(data, type) || "";
    return {
        title: data.title || data.name || "",
        originalTitle: data.original_title || data.original_name || "",
        year: releaseDate.split("-")[0] || "",
        releaseDate,
        overview: data.overview || "",
        originalOverview: data.overview || "",
        poster,
        genres: Array.isArray(data.genres) ? data.genres.map((genre) => genre.name) : [],
        tmdbId: data.id,
        runtime: getRuntime(data, type)
    };
}

async function fetchTmdbData(tmdbId, type) {
    const query = new URLSearchParams({ api_key: API_KEY, language: LANGUAGE });
    const url = `https://api.themoviedb.org/3/${type}/${encodeURIComponent(tmdbId)}?${query}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`TMDB devolvio ${response.status} ${response.statusText}`);
    }
    return response.json();
}

async function downloadPoster(posterPath, tmdbId) {
    if (!posterPath) return null;

    const posterFile = path.join(__dirname, "..", "img", "posters", `${tmdbId}.jpg`);
    const posterUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
    if (await fs.pathExists(posterFile)) return `img/posters/${tmdbId}.jpg`;

    const response = await fetch(posterUrl);
    if (!response.ok) throw new Error(`poster devolvio ${response.status} ${response.statusText}`);
    await fs.ensureDir(path.dirname(posterFile));
    await fs.writeFile(posterFile, Buffer.from(await response.arrayBuffer()));
    return `img/posters/${tmdbId}.jpg`;
}

function validateUniqueIds(movies) {
    const ids = movies.map((movie) => normalizeId(movie.tmdbId));
    const duplicateIds = ids.filter((id, index) => id && ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
        throw new Error(`movies.json contiene tmdbId duplicados: ${[...new Set(duplicateIds)].join(", ")}`);
    }
}

async function validateTemporaryFile(filePath, originalMovies) {
    const savedMovies = await fs.readJson(filePath);
    if (!Array.isArray(savedMovies) || savedMovies.length < originalMovies.length) {
        throw new Error("La validacion fallo: movies.json no puede perder peliculas.");
    }

    const originalIds = new Set(originalMovies.map((movie) => normalizeId(movie.tmdbId)));
    const savedIds = savedMovies.map((movie) => normalizeId(movie.tmdbId));
    if (savedIds.some((tmdbId) => !tmdbId) || new Set(savedIds).size !== savedIds.length) {
        throw new Error("La validacion fallo: todos los tmdbId deben existir y ser unicos.");
    }
    if ([...originalIds].some((tmdbId) => !savedIds.includes(tmdbId))) {
        throw new Error("La validacion fallo: desaparecio un tmdbId existente.");
    }
}

async function main() {
    if (!API_KEY) throw new Error("Falta la API key. Define TMDB_API_KEY antes de ejecutar el script.");
    if (!await fs.pathExists(MOVIES_JSON)) throw new Error(`No se encontro ${MOVIES_JSON}.`);
    if (!await fs.pathExists(MANUAL_MATCHES_JSON)) throw new Error(`No se encontro ${MANUAL_MATCHES_JSON}.`);

    const movies = await fs.readJson(MOVIES_JSON);
    const manualMatches = await fs.readJson(MANUAL_MATCHES_JSON);
    if (!Array.isArray(movies)) throw new Error("movies.json debe contener un arreglo de peliculas.");
    if (!manualMatches || typeof manualMatches !== "object" || Array.isArray(manualMatches)) {
        throw new Error("manualMatches.json debe contener un objeto de correspondencias.");
    }
    validateUniqueIds(movies);

    const updatedMovies = movies.map((movie) => ({ ...movie }));
    const moviesById = new Map(updatedMovies.map((movie, index) => [normalizeId(movie.tmdbId), index]));
    const seenManualIds = new Set();
    const stats = { added: 0, updated: 0, skipped: 0, duplicated: 0, failed: 0 };

    for (const [label, value] of getManualMatches(manualMatches)) {
        const { tmdbId, type } = getMatchDetails(value);
        const normalizedId = normalizeId(tmdbId);
        if (!normalizedId) {
            stats.failed += 1;
            console.warn(`Sin ID en manualMatches: ${label}`);
            continue;
        }
        if (seenManualIds.has(`${type}:${normalizedId}`)) {
            stats.duplicated += 1;
            console.warn(`ID repetido en manualMatches, se omite: ${type}/${normalizedId}`);
            continue;
        }
        seenManualIds.add(`${type}:${normalizedId}`);

        const existingIndex = moviesById.get(normalizedId);
        const existingMovie = existingIndex === undefined ? null : updatedMovies[existingIndex];
        if (existingMovie && !forceUpdate && isValidReleaseDate(existingMovie.releaseDate)
            && isValidRuntime(existingMovie.runtime) && !dryRun) {
            stats.skipped += 1;
            console.log(`Ya existe con releaseDate, se omite: ${existingMovie.title || normalizedId}`);
            continue;
        }

        try {
            const data = await fetchTmdbData(normalizedId, type);
            const poster = dryRun ? existingMovie?.poster || null : await downloadPoster(data.poster_path, normalizedId);
            const movieData = buildMovieData(data, type, poster || existingMovie?.poster || null);

            if (existingMovie) {
                updatedMovies[existingIndex] = { ...existingMovie, ...movieData, poster: movieData.poster || existingMovie.poster };
                stats.updated += 1;
                console.log(`Actualizada: ${movieData.title || normalizedId}`);
            } else {
                updatedMovies.push(movieData);
                moviesById.set(normalizedId, updatedMovies.length - 1);
                stats.added += 1;
                console.log(`Agregada: ${movieData.title || normalizedId}`);
            }
        } catch (error) {
            stats.failed += 1;
            console.error(`Error con ${type}/${normalizedId}: ${error.message}`);
        }

        await wait(DELAY_MS);
    }

    if (!dryRun && stats.added + stats.updated > 0) {
        const temporaryFile = `${MOVIES_JSON}.tmp`;
        await fs.writeJson(temporaryFile, updatedMovies, { spaces: 2 });
        await validateTemporaryFile(temporaryFile, movies);
        const backupFile = getBackupPath();
        await fs.copyFile(MOVIES_JSON, backupFile);
        await fs.rename(temporaryFile, MOVIES_JSON);
        console.log(`Copia de seguridad: ${backupFile}`);
    }

    if (dryRun) console.log("Modo simulacion: no se modificaron archivos.");
    console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
    console.error(`Proceso cancelado: ${error.message}`);
    process.exitCode = 1;
});
