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
const METADATA_FIELDS = ["parsedTitle", "parsedYear", "releaseDate"];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function isValidReleaseDate(value) {
    if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getBackupPath() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${MOVIES_JSON}.${timestamp}.bak`;
}

async function getMovieMetadata(tmdbId) {
    const query = new URLSearchParams({ api_key: API_KEY, language: LANGUAGE });
    const url = `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}?${query}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`TMDB devolvio ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const releaseDate = isValidReleaseDate(data.release_date) ? data.release_date : null;
    const title = typeof data.title === "string" && data.title.trim()
        ? data.title
        : typeof data.name === "string" && data.name.trim()
            ? data.name
            : null;

    return {
        parsedTitle: title,
        parsedYear: releaseDate ? releaseDate.slice(0, 4) : null,
        releaseDate
    };
}

function findMovieObjectRanges(source) {
    const ranges = [];
    const stack = [];
    let inString = false;
    let escaped = false;
    let objectStart = -1;

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (inString) {
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === "\"") inString = false;
            continue;
        }
        if (character === "\"") {
            inString = true;
            continue;
        }
        if (character === "{" || character === "[") {
            if (character === "{" && stack.length === 1 && stack[0] === "[") {
                objectStart = index;
            }
            stack.push(character);
        } else if (character === "}" || character === "]") {
            const opening = stack.pop();
            if ((character === "}" && opening !== "{") || (character === "]" && opening !== "[")) {
                throw new Error("movies.json contiene una estructura JSON invalida.");
            }
            if (character === "}" && stack.length === 1 && stack[0] === "[") {
                ranges.push({ start: objectStart, end: index + 1 });
                objectStart = -1;
            }
        }
    }

    if (inString || stack.length !== 0) {
        throw new Error("movies.json contiene una estructura JSON incompleta.");
    }
    return ranges;
}

function insertMissingMetadata(source, ranges, movies, metadataByIndex) {
    const edits = [];
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    for (let index = 0; index < ranges.length; index += 1) {
        const metadata = metadataByIndex.get(index);
        if (!metadata) continue;

        const movie = movies[index];
        const missingFields = METADATA_FIELDS.filter((field) =>
            !Object.prototype.hasOwnProperty.call(movie, field) && metadata[field]
        );
        if (missingFields.length === 0) continue;

        let insertionPoint = ranges[index].end - 2;
        while (insertionPoint >= ranges[index].start && /\s/.test(source[insertionPoint])) {
            insertionPoint -= 1;
        }
        insertionPoint += 1;

        const additions = missingFields
            .map((field) => `    ${JSON.stringify(field)}: ${JSON.stringify(metadata[field])}`)
            .join(`,${newline}`);
        edits.push({
            position: insertionPoint,
            text: `${insertionPoint > ranges[index].start ? "," : ""}${newline}${additions}`
        });
    }

    let result = source;
    for (const edit of edits.sort((left, right) => right.position - left.position)) {
        result = `${result.slice(0, edit.position)}${edit.text}${result.slice(edit.position)}`;
    }
    return result;
}

async function validateTemporaryFile(filePath, originalMovies, expectedMetadata) {
    const savedMovies = await fs.readJson(filePath);
    if (!Array.isArray(savedMovies) || savedMovies.length !== originalMovies.length) {
        throw new Error("La validacion fallo: cambio el numero de peliculas.");
    }

    for (let index = 0; index < originalMovies.length; index += 1) {
        const original = originalMovies[index];
        const saved = savedMovies[index];
        for (const [field, value] of Object.entries(original)) {
            if (JSON.stringify(saved[field]) !== JSON.stringify(value)) {
                throw new Error(`La validacion fallo: se modifico el campo ${field} de ${original.title || index}.`);
            }
        }
        for (const field of Object.keys(saved)) {
            if (!Object.prototype.hasOwnProperty.call(original, field)) {
                const expected = expectedMetadata.get(index);
                if (!METADATA_FIELDS.includes(field) || !expected || saved[field] !== expected[field]) {
                    throw new Error(`La validacion fallo: se agrego un campo inesperado (${field}).`);
                }
            }
        }

        const expected = expectedMetadata.get(index);
        if (expected) {
            for (const field of METADATA_FIELDS) {
                if (!Object.prototype.hasOwnProperty.call(original, field) && expected[field]
                    && saved[field] !== expected[field]) {
                    throw new Error(`La validacion fallo: no se agrego correctamente ${field} a ${original.title || index}.`);
                }
            }
        }
    }
}

async function main() {
    if (!API_KEY) {
        throw new Error("Falta la API key. Define TMDB_API_KEY antes de ejecutar el script.");
    }
    if (!await fs.pathExists(MOVIES_JSON)) {
        throw new Error(`No se encontro ${MOVIES_JSON}.`);
    }

    const source = await fs.readFile(MOVIES_JSON, "utf8");
    const movies = JSON.parse(source);
    if (!Array.isArray(movies)) {
        throw new Error("movies.json debe contener un arreglo de peliculas.");
    }
    const objectRanges = findMovieObjectRanges(source);
    if (objectRanges.length !== movies.length) {
        throw new Error("No se pudieron relacionar los objetos de movies.json con sus peliculas.");
    }

    const metadataByIndex = new Map();
    const stats = { updated: 0, skipped: 0, missingId: 0, missingData: 0, failed: 0 };
    const fieldsAdded = { parsedTitle: 0, parsedYear: 0, releaseDate: 0 };

    for (let index = 0; index < movies.length; index += 1) {
        const movie = movies[index];
        const missingFields = METADATA_FIELDS.filter((field) =>
            !Object.prototype.hasOwnProperty.call(movie, field)
        );
        if (missingFields.length === 0) {
            stats.skipped += 1;
            continue;
        }
        if (!movie.tmdbId) {
            stats.missingId += 1;
            console.warn(`Sin tmdbId: ${movie.title || "pelicula sin titulo"}`);
            continue;
        }

        try {
            const metadata = await getMovieMetadata(movie.tmdbId);
            const availableMetadata = Object.fromEntries(
                missingFields
                    .filter((field) => metadata[field])
                    .map((field) => [field, metadata[field]])
            );
            if (Object.keys(availableMetadata).length === 0) {
                stats.missingData += 1;
                console.warn(`TMDB no devolvio datos utilizables: ${movie.title || movie.tmdbId}`);
            } else {
                metadataByIndex.set(index, availableMetadata);
                for (const field of Object.keys(availableMetadata)) fieldsAdded[field] += 1;
                stats.updated += 1;
                console.log(`${movie.title || movie.tmdbId}: ${JSON.stringify(availableMetadata)}`);
            }
        } catch (error) {
            stats.failed += 1;
            console.error(`Error con ${movie.title || movie.tmdbId}: ${error.message}`);
        }

        await wait(DELAY_MS);
    }

    if (metadataByIndex.size > 0) {
        const temporaryFile = `${MOVIES_JSON}.tmp`;
        const backupFile = getBackupPath();
        const updatedSource = insertMissingMetadata(source, objectRanges, movies, metadataByIndex);
        await fs.writeFile(temporaryFile, updatedSource, "utf8");
        await validateTemporaryFile(temporaryFile, movies, metadataByIndex);
        await fs.copyFile(MOVIES_JSON, backupFile);
        await fs.rename(temporaryFile, MOVIES_JSON);
        console.log(`Copia de seguridad: ${backupFile}`);
    }

    stats.fieldsAdded = fieldsAdded;
    console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
    console.error(`Proceso cancelado: ${error.message}`);
    process.exitCode = 1;
});
