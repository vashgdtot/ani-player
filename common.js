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
  if (!pathname.toLowerCase().endsWith('.mp4')) {
    throw new Error('請輸入 .mp4 影片網址');
  }

  const fileName = pathname.split('/').filter(Boolean).pop() || 'video.mp4';
  const baseName = fileName.replace(/\.mp4$/i, '');
  const episodeMatch = findEpisodeMatch(baseName) || findEpisodeMatch(pathname);
  const episode = episodeMatch ? Number.parseInt(episodeMatch.value, 10) : 1;
  const episodeToken = episodeMatch ? episodeMatch.full : String(episode);
  const inferredName = inferAnimeName(baseName, episodeMatch);

  return {
    url,
    animeName: inferredName || parsed.hostname || '未命名動畫',
    episode,
    episodeWidth: episodeMatch ? episodeMatch.value.length : String(episode).length,
    episodeToken,
    fileName
  };
}

function findEpisodeMatch(text) {
  const patterns = [
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
    .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
    .replace(/\b(?:ep|episode)\b\s*$/i, '')
    .replace(/第\s*$/u, '')
    .trim();
}

function buildEpisodeUrl(currentUrl, currentEpisode, nextEpisode, width) {
  const paddedCurrent = String(currentEpisode).padStart(width, '0');
  const paddedNext = String(nextEpisode).padStart(width, '0');
  const replacements = [
    [new RegExp(`(ep(?:isode)?[-_\\s]*)${paddedCurrent}(?=[^0-9]*\\.mp4)`, 'i'), `$1${paddedNext}`],
    [new RegExp(`(第[-_\\s]*)${paddedCurrent}((?:話|集)?(?=[^0-9]*\\.mp4))`, 'i'), `$1${paddedNext}$2`],
    [new RegExp(`(^|[^0-9])${paddedCurrent}([^0-9]*\\.mp4)`, 'i'), `$1${paddedNext}$2`]
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(currentUrl)) return currentUrl.replace(pattern, replacement);
  }

  return currentUrl.replace(/\.mp4(\?.*)?$/i, `${paddedNext}.mp4$1`);
}

async function storageGet(defaults) {
  return chrome.storage.local.get(defaults);
}

async function storageSet(values) {
  return chrome.storage.local.set(values);
}

async function getRecentWatches() {
  const result = await storageGet({ [RECENT_WATCHES_KEY]: [] });
  return Array.isArray(result[RECENT_WATCHES_KEY]) ? result[RECENT_WATCHES_KEY] : [];
}

async function saveRecentWatch(entry) {
  const watches = await getRecentWatches();
  const now = new Date().toISOString();
  const id = entry.id || `${entry.animeName}|${entry.url}`;
  const nextEntry = { ...entry, id, updatedAt: now };
  const filtered = watches.filter((item) => item.id !== id);
  await storageSet({ [RECENT_WATCHES_KEY]: [nextEntry, ...filtered].slice(0, MAX_RECENT_WATCHES) });
  return nextEntry;
}

async function deleteRecentWatch(id) {
  const watches = await getRecentWatches();
  await storageSet({ [RECENT_WATCHES_KEY]: watches.filter((item) => item.id !== id) });
}
