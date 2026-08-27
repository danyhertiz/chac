import fs from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MOVIES_JSON = path.join(__dirname, "movies.json");
const API_KEY = process.env.TMDB_API_KEY || "79babdd2d24b858c4488b987a2743aef";
const LANGUAGE = "es-MX";
const DELAY_MS = 250;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const forceUpdate = process.argv.includes("--force");

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function isValidReleaseDate(value) {
    return typeof value === "string" && DATE_PATTERN.test(value);
}

function backupPath() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${MOVIES_JSON}.${timestamp}.bak`;
}

async function getReleaseDate(tmdbId) {
    const query = new URLSearchParams({ api_key: API_KEY, language: LANGUAGE });
    const url = `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}?${query}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`TMDB devolvio ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.release_date || null;
}

async function validateFile(filePath, expectedMovies, expectedIds) {
    const parsedMovies = await fs.readJson(filePath);
    if (!Array.isArray(parsedMovies) || parsedMovies.length !== expectedMovies) {
        throw new Error("La validacion fallo: cambio el numero de peliculas.");
    }

    const parsedIds = parsedMovies.map((movie) => movie.tmdbId);
    if (parsedIds.some((tmdbId, index) => tmdbId !== expectedIds[index])) {
        throw new Error("La validacion fallo: cambio el orden o algun tmdbId.");
    }
}

async function main() {
    if (!API_KEY) {
        throw new Error("Falta la API key. Define TMDB_API_KEY antes de ejecutar el script.");
    }
    if (!await fs.pathExists(MOVIES_JSON)) {
        throw new Error(`No se encontro ${MOVIES_JSON}.`);
    }

    const movies = await fs.readJson(MOVIES_JSON);
    if (!Array.isArray(movies)) {
        throw new Error("movies.json debe contener un arreglo de peliculas.");
    }

    const updatedMovies = movies.map((movie) => ({ ...movie }));
    const expectedIds = movies.map((movie) => movie.tmdbId);
    const stats = { added: 0, updated: 0, skipped: 0, missingId: 0, failed: 0 };

    for (let index = 0; index < updatedMovies.length; index += 1) {
        const movie = updatedMovies[index];
        if (!forceUpdate && isValidReleaseDate(movie.releaseDate)) {
            stats.skipped += 1;
            continue;
        }
        if (!movie.tmdbId) {
            stats.missingId += 1;
            console.warn(`Sin tmdbId: ${movie.title || "pelicula sin titulo"}`);
            continue;
        }

        try {
            const releaseDate = await getReleaseDate(movie.tmdbId);
            if (isValidReleaseDate(releaseDate)) {
                if (movie.releaseDate) stats.updated += 1;
                else stats.added += 1;
                movie.releaseDate = releaseDate;
                console.log(`${movie.title || movie.tmdbId}: ${releaseDate}`);
            } else {
                stats.failed += 1;
                console.warn(`TMDB no devolvio una fecha valida: ${movie.title || movie.tmdbId}`);
            }
        } catch (error) {
            stats.failed += 1;
            console.error(`Error con ${movie.title || movie.tmdbId}: ${error.message}`);
        }

        await wait(DELAY_MS);
    }

    const changed = stats.added + stats.updated > 0;
    if (changed) {
        const temporaryFile = `${MOVIES_JSON}.tmp`;
        const backupFile = backupPath();
        await fs.writeJson(temporaryFile, updatedMovies, { spaces: 2 });
        await validateFile(temporaryFile, movies.length, expectedIds);
        await fs.copyFile(MOVIES_JSON, backupFile);
        await fs.rename(temporaryFile, MOVIES_JSON);
        console.log(`Copia de seguridad: ${backupFile}`);
    }

    console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
    console.error(`Proceso cancelado: ${error.message}`);
    process.exitCode = 1;
});
