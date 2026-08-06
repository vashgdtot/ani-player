const RECENT_WATCHES_KEY = 'recentWatches';
const PENDING_VIDEO_KEY = 'pendingVideo';
const MAX_RECENT_WATCHES = 50;

function parseMp4Url(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) throw new Error('請輸入 MP4 URL');

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL 格式不正確');
  }

  const pathname = decodeURIComponent(parsed.pathname);
  if (!isMp4Resource(parsed)) {
    throw new Error('請輸入 MP4 影片網址，或帶有 ?d=mp4 的影片網址');
  }

  const fileName = getVideoFileName(pathname, parsed);
  const baseName = fileName.replace(/\.mp4$/i, '');
  const searchableName = stripBracketTags(baseName);
  const episodeMatch = findEpisodeMatch(searchableName) || findEpisodeMatch(stripBracketTags(pathname));
  const episode = episodeMatch ? Number.parseInt(episodeMatch.value, 10) : 1;
  const episodeToken = episodeMatch ? episodeMatch.full : String(episode);
  const inferredName = inferAnimeName(searchableName, episodeMatch);

  return {
    url,
    animeName: inferredName || parsed.hostname || '未命名動畫',
    episode,
    episodeWidth: episodeMatch ? episodeMatch.value.length : String(episode).length,
    episodeToken,
    fileName
  };
}

function isMp4Resource(parsed) {
  return parsed.pathname.toLowerCase().endsWith('.mp4') || parsed.searchParams.get('d')?.toLowerCase() === 'mp4';
}

function getVideoFileName(pathname, parsed) {
  const pathName = pathname.split('/').filter(Boolean).pop() || '';
  if (pathName) return pathName;
  return parsed.hostname || 'video.mp4';
}

function stripBracketTags(text) {
  return text.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ');
}

function findEpisodeMatch(text) {
  const patterns = [
    /[-_\s]+(\d{1,4})(?=\s*(?:$|[-_\s]|話|集|\[))/i,
    /(?:^|[^a-z0-9])(?:ep|episode|第)\s*(\d{1,4})(?:話|集)?(?=$|[^a-z0-9])/i,
    /(?:^|[^\d])(\d{1,4})(?:話|集)(?=$|[^\d])/,
    /(?:^|[^\d])(\d{1,4})(?=$|[^\d]*$)/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return { full: match[0], value: match[1], index: match.index };
  }
  return null;
}

function inferAnimeName(baseName, episodeMatch) {
  let name = baseName;
  if (episodeMatch) {
    const tokenIndex = Math.max(0, episodeMatch.index);
    name = baseName.slice(0, tokenIndex) || baseName.replace(episodeMatch.full, '');
  }

  return name
    .replace(/[._-]+/g, ' ')
    .replace(/\b(?:ep|episode)\b\s*$/i, '')
    .replace(/第\s*$/u, '')
    .trim();
}

function buildEpisodeUrl(currentUrl, currentEpisode, nextEpisode, width) {
  const paddedCurrent = String(currentEpisode).padStart(width, '0');
  const paddedNext = String(nextEpisode).padStart(width, '0');

  try {
    const parsed = new URL(currentUrl);
    const decodedPath = decodeURIComponent(parsed.pathname);
    const nextPath = replaceEpisodeInText(decodedPath, paddedCurrent, paddedNext);
    if (nextPath !== decodedPath) {
      parsed.pathname = nextPath;
      return parsed.toString();
    }
  } catch {
    // Fall back to string replacement for non-standard URLs.
  }

  const nextUrl = replaceEpisodeInText(currentUrl, paddedCurrent, paddedNext);
  if (nextUrl !== currentUrl) return nextUrl;

  if (/\.mp4(\?.*)?$/i.test(currentUrl)) {
    return currentUrl.replace(/\.mp4(\?.*)?$/i, `${paddedNext}.mp4$1`);
  }

  const separator = currentUrl.includes('?') ? '&' : '?';
  return `${currentUrl}${separator}episode=${paddedNext}`;
}

function replaceEpisodeInText(text, paddedCurrent, paddedNext) {
  const replacements = [
    [new RegExp(`([-_\\s]+)${paddedCurrent}(?=\\s*(?:$|[-_\\s]|話|集|\\[))`, 'i'), `$1${paddedNext}`],
    [new RegExp(`(ep(?:isode)?[-_\\s]*)${paddedCurrent}(?=$|[^0-9])`, 'i'), `$1${paddedNext}`],
    [new RegExp(`(第[-_\\s]*)${paddedCurrent}((?:話|集)?(?=$|[^0-9]))`, 'i'), `$1${paddedNext}$2`],
    [new RegExp(`(^|[^0-9])${paddedCurrent}([^0-9]*(?:\\.mp4)?(?:\\?.*)?$)`, 'i'), `$1${paddedNext}$2`]
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }

  return text;
}

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage?.local;
}

async function storageGet(defaults) {
  if (hasChromeStorage()) return chrome.storage.local.get(defaults);

  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const storedValue = localStorage.getItem(key);
    if (storedValue !== null) result[key] = JSON.parse(storedValue);
  }
  return result;
}

async function storageSet(values) {
  if (hasChromeStorage()) return chrome.storage.local.set(values);

  for (const [key, value] of Object.entries(values)) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

async function getRecentWatches() {
  const result = await storageGet({ [RECENT_WATCHES_KEY]: [] });
  return Array.isArray(result[RECENT_WATCHES_KEY]) ? result[RECENT_WATCHES_KEY] : [];
}

function getRecentWatchId(entry) {
  const animeKey = normalizeAnimeKey(entry.animeName);
  return animeKey ? `anime:${animeKey}` : `url:${entry.url}`;
}

function normalizeAnimeKey(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

async function saveRecentWatch(entry) {
  const watches = await getRecentWatches();
  const now = new Date().toISOString();
  const id = getRecentWatchId(entry);
  const animeKey = normalizeAnimeKey(entry.animeName);
  const nextEntry = { ...entry, id, updatedAt: now };
  const filtered = watches.filter((item) => {
    const sameId = item.id === id || item.id === entry.id;
    const sameAnime = animeKey && normalizeAnimeKey(item.animeName) === animeKey;
    return !sameId && !sameAnime;
  });
  await storageSet({ [RECENT_WATCHES_KEY]: [nextEntry, ...filtered].slice(0, MAX_RECENT_WATCHES) });
  return nextEntry;
}

async function deleteRecentWatch(id) {
  const watches = await getRecentWatches();
  await storageSet({ [RECENT_WATCHES_KEY]: watches.filter((item) => item.id !== id) });
}
