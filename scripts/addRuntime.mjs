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
const onlyMissing = process.argv.includes("--only-missing");
const dryRun = process.argv.includes("--dry-run");

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const normalizeId = (tmdbId) => tmdbId === undefined || tmdbId === null ? "" : String(tmdbId);
const isValidRuntime = (runtime) => Number.isInteger(runtime) && runtime > 0;

function getBackupPath() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${MOVIES_JSON}.${timestamp}.bak`;
}

function getTypeById(manualMatches) {
    const typesById = new Map();
    for (const [, value] of Object.entries(manualMatches)) {
        const match = typeof value === "object" && value !== null
            ? { id: value.id, type: value.type || "movie" }
            : { id: value, type: "movie" };
        if (match.id !== undefined && match.id !== null) typesById.set(normalizeId(match.id), match.type);
    }
    return typesById;
}

async function fetchRuntime(tmdbId, type) {
    const query = new URLSearchParams({ api_key: API_KEY, language: LANGUAGE });
    const url = `https://api.themoviedb.org/3/${type}/${encodeURIComponent(tmdbId)}?${query}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`TMDB devolvio ${response.status} ${response.statusText}`);

    const data = await response.json();
    const runtime = type === "tv" ? data.episode_run_time?.[0] : data.runtime;
    return Number.isInteger(runtime) && runtime > 0 ? runtime : null;
}

async function validateTemporaryFile(filePath, originalMovies) {
    const savedMovies = await fs.readJson(filePath);
    if (!Array.isArray(savedMovies) || savedMovies.length !== originalMovies.length) {
        throw new Error("La validacion fallo: cambio el numero de peliculas.");
    }

    const originalIds = originalMovies.map((movie) => normalizeId(movie.tmdbId));
    const savedIds = savedMovies.map((movie) => normalizeId(movie.tmdbId));
    if (savedIds.some((tmdbId) => !tmdbId) || new Set(savedIds).size !== savedIds.length) {
        throw new Error("La validacion fallo: los tmdbId deben existir y ser unicos.");
    }
    if (savedIds.some((tmdbId, index) => tmdbId !== originalIds[index])) {
        throw new Error("La validacion fallo: cambio el orden o algun tmdbId.");
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

    const typesById = getTypeById(manualMatches);
    const updatedMovies = movies.map((movie) => ({ ...movie }));
    const seenIds = new Set();
    const stats = { updated: 0, skipped: 0, missingId: 0, missingRuntime: 0, failed: 0 };

    for (const movie of updatedMovies) {
        const tmdbId = normalizeId(movie.tmdbId);
        if (!tmdbId) {
            stats.missingId += 1;
            console.warn(`Sin tmdbId: ${movie.title || "pelicula sin titulo"}`);
            continue;
        }
        if (seenIds.has(tmdbId)) throw new Error(`tmdbId duplicado en movies.json: ${tmdbId}`);
        seenIds.add(tmdbId);
        if (onlyMissing && isValidRuntime(movie.runtime)) {
            stats.skipped += 1;
            continue;
        }

        try {
            const type = typesById.get(tmdbId) || "movie";
            const runtime = await fetchRuntime(tmdbId, type);
            if (runtime === null) {
                stats.missingRuntime += 1;
                console.warn(`TMDB no devolvio una duracion valida: ${movie.title || tmdbId}`);
            } else {
                movie.runtime = runtime;
                stats.updated += 1;
                console.log(`${movie.title || tmdbId}: ${runtime} min`);
            }
        } catch (error) {
            stats.failed += 1;
            console.error(`Error con ${type}/${tmdbId}: ${error.message}`);
        }
        await wait(DELAY_MS);
    }

    if (!dryRun && stats.updated > 0) {
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
