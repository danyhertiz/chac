import { readFile, writeFile } from 'fs/promises';

const DRY_RUN = false;
const INPUT_FILE = new URL('./movies.json', import.meta.url);
const OUTPUT_FILE = new URL('./movies.cleaned.json', import.meta.url);

function safeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidOverview(value) {
  const text = safeString(value);
  return text.length > 0 && !/^no disponible$/iu.test(text);
}

function scoreMovie(movie) {
  const poster = safeString(movie.poster);
  const overview = safeString(movie.overview);
  const validOverview = isValidOverview(movie.overview);
  const hasGenres = Array.isArray(movie.genres) && movie.genres.length > 0;
  const hasRuntime = movie.runtime != null;
  const hasOriginalOverview = safeString(movie.originalOverview).length > 0;
  const hasSourceFile = safeString(movie.sourceFile).length > 0;

  const score = {
    poster: poster ? 2 : -2,
    overview: validOverview ? 2 : overview ? -1 : -2,
    genres: hasGenres ? 1 : -1,
    runtime: hasRuntime ? 1 : -1,
    originalOverview: hasOriginalOverview ? 1 : 0,
    sourceFile: hasSourceFile ? 1 : 0
  };

  const total = Object.values(score).reduce((sum, value) => sum + value, 0);
  return { total, score };
}

function buildGroupKey(movie) {
  if (movie.tmdbId == null) return null;
  return String(movie.tmdbId);
}

function formatDebug(movie, total) {
  return `- title: ${safeString(movie.title) || safeString(movie.originalTitle) || '<sin título>'}\n  sourceFile: ${safeString(movie.sourceFile) || '<missing>'}\n  score: ${total}`;
}

async function main() {
  try {
    const fileContent = await readFile(INPUT_FILE, 'utf8');
    const movies = JSON.parse(fileContent);

    if (!Array.isArray(movies)) {
      console.error('movies.json debe contener un arreglo de películas.');
      process.exit(1);
    }

    const groups = new Map();

    for (const movie of movies) {
      const key = buildGroupKey(movie);
      if (!key) continue;
      const list = groups.get(key) || [];
      list.push(movie);
      groups.set(key, list);
    }

    let removedCount = 0;
    const removals = new Set();

    for (const [key, group] of groups.entries()) {
      if (group.length < 2) continue;

      const scoredGroup = group.map((movie, index) => {
        const { total } = scoreMovie(movie);
        return { movie, total, index };
      });

      scoredGroup.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.index - b.index;
      });

      const keeper = scoredGroup[0];
      const removed = scoredGroup.slice(1);

      console.log('[DUPLICATE GROUP]');
      console.log(`tmdbId: ${key}`);
      console.log('KEEP:');
      console.log(formatDebug(keeper.movie, keeper.total));
      console.log('REMOVE:');
      for (const item of removed) {
        console.log(formatDebug(item.movie, item.total));
        console.log('  reason: duplicate tmdbId');
      }
      console.log('');

      for (const item of removed) {
        removals.add(item.movie);
      }
      removedCount += removed.length;
    }

    const cleanedMovies = movies.filter((movie) => !removals.has(movie));
    console.log(`Total duplicates removed: ${removedCount}`);
    console.log(`Total movies remaining: ${cleanedMovies.length}`);

    if (DRY_RUN) {
      console.log('DRY_RUN está activado. No se escribió ningún archivo.');
      return;
    }

    const outputContent = JSON.stringify(cleanedMovies, null, 2) + '\n';
    await writeFile(OUTPUT_FILE, outputContent, 'utf8');
    console.log(`Se escribió ${OUTPUT_FILE.pathname}`);
  } catch (error) {
    console.error('Error al procesar movies.json:', error?.message || error);
    process.exit(1);
  }
}

main();
