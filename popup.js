const urlInput = document.querySelector('#mp4Url');
const parsedInfo = document.querySelector('#parsedInfo');
const openButton = document.querySelector('#openViewer');
const message = document.querySelector('#message');
const recentList = document.querySelector('#recentList');
const clearForm = document.querySelector('#clearForm');
const externalViewerUrlInput = document.querySelector('#externalViewerUrl');
let parsedVideo = null;

function setMessage(text, type = '') {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function updateParsedInfo() {
  try {
    parsedVideo = parseMp4Url(urlInput.value);
    parsedInfo.innerHTML = `<strong>${escapeHtml(parsedVideo.animeName)}</strong><span>目前第 ${parsedVideo.episode} 集</span>`;
    setMessage('');
  } catch (error) {
    parsedVideo = null;
    parsedInfo.textContent = error.message || '無法解析網址';
  }
}

async function openViewer(video) {
  const externalViewerUrl = normalizeExternalViewerUrl(externalViewerUrlInput.value);
  await storageSet({
    [PENDING_VIDEO_KEY]: { ...video, currentTime: video.currentTime || 0 },
    [EXTERNAL_VIEWER_URL_KEY]: externalViewerUrl
  });
  await saveRecentWatch({ ...video, currentEpisode: video.episode, lastTime: video.currentTime || 0 });
  await chrome.tabs.create({ url: buildViewerTabUrl(video, externalViewerUrl) });
}

function buildViewerTabUrl(video, externalViewerUrl) {
  if (!externalViewerUrl) return chrome.runtime.getURL('viewer.html');

  const viewerUrl = new URL(externalViewerUrl);
  viewerUrl.searchParams.set('url', video.url);
  viewerUrl.searchParams.set('animeName', video.animeName);
  viewerUrl.searchParams.set('episode', String(video.episode));
  viewerUrl.searchParams.set('episodeWidth', String(video.episodeWidth));
  viewerUrl.searchParams.set('currentTime', String(video.currentTime || video.lastTime || 0));
  return viewerUrl.toString();
}

function normalizeExternalViewerUrl(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';
  if (/^file:\/\//i.test(rawValue) || /^https?:\/\//i.test(rawValue)) return rawValue;

  const normalizedPath = rawValue.replace(/\\/g, '/');
  if (/^[a-z]:\//i.test(normalizedPath)) return `file:///${normalizedPath}`;
  if (normalizedPath.startsWith('/')) return `file://${normalizedPath}`;
  return rawValue;
}

async function renderRecent() {
  const watches = await getRecentWatches();
  recentList.textContent = '';
  if (!watches.length) {
    recentList.innerHTML = '<p class="empty">尚無最近觀看。</p>';
    return;
  }

  for (const item of watches) {
    const row = document.createElement('article');
    row.className = 'recent-item';
    row.innerHTML = `
      <div>
        <input class="edit-name" value="${escapeAttr(item.animeName)}" aria-label="動畫名稱">
        <p>第 ${item.currentEpisode || item.episode} 集 · ${formatSeconds(item.lastTime || 0)}</p>
      </div>
      <div class="recent-actions">
        <button data-action="open">開啟</button>
        <button data-action="save">儲存</button>
        <button data-action="delete" class="danger">刪除</button>
      </div>`;

    row.querySelector('[data-action="open"]').addEventListener('click', () => openViewer({
      ...item,
      episode: item.currentEpisode || item.episode,
      currentTime: item.lastTime || 0
    }));
    row.querySelector('[data-action="save"]').addEventListener('click', async () => {
      await saveRecentWatch({ ...item, animeName: row.querySelector('.edit-name').value.trim() || item.animeName });
      setMessage('已更新最近觀看。', 'success');
      renderRecent();
    });
    row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      await deleteRecentWatch(item.id);
      setMessage('已刪除。', 'success');
      renderRecent();
    });
    recentList.append(row);
  }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function escapeAttr(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function formatSeconds(seconds) {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

async function loadSettings() {
  const result = await storageGet({ [EXTERNAL_VIEWER_URL_KEY]: '' });
  externalViewerUrlInput.value = result[EXTERNAL_VIEWER_URL_KEY] || '';
}

urlInput.addEventListener('input', updateParsedInfo);
clearForm.addEventListener('click', () => {
  urlInput.value = '';
  updateParsedInfo();
});
openButton.addEventListener('click', async () => {
  updateParsedInfo();
  if (!parsedVideo) {
    setMessage('請先輸入有效的 MP4 URL。', 'error');
    return;
  }
  await openViewer(parsedVideo);
});
externalViewerUrlInput.addEventListener('change', async () => {
  externalViewerUrlInput.value = normalizeExternalViewerUrl(externalViewerUrlInput.value);
  await storageSet({ [EXTERNAL_VIEWER_URL_KEY]: externalViewerUrlInput.value });
});

loadSettings();
renderRecent();
