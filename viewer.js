const title = document.querySelector('#animeTitle');
const summary = document.querySelector('#episodeSummary');
const episodeList = document.querySelector('#episodeList');
const player = document.querySelector('#player');
const prevButton = document.querySelector('#prevEpisode');
const nextButton = document.querySelector('#nextEpisode');
const statusText = document.querySelector('#status');

let state = null;
let saveTimer = null;

async function init() {
  const result = await storageGet({ [PENDING_VIDEO_KEY]: null });
  if (!result[PENDING_VIDEO_KEY]) {
    statusText.textContent = '找不到要播放的影片，請從 Popup 開啟。';
    return;
  }

  const video = result[PENDING_VIDEO_KEY];
  state = {
    ...video,
    currentEpisode: video.episode || video.currentEpisode || 1,
    maxEpisode: Math.max(video.episode || 1, video.currentEpisode || 1),
    episodeWidth: video.episodeWidth || String(video.episode || 1).length,
    episodeUrls: { [video.episode || video.currentEpisode || 1]: video.url }
  };
  await playEpisode(state.currentEpisode, video.url, video.currentTime || video.lastTime || 0);
  render();
}

async function playEpisode(episode, url, startTime = 0) {
  state.currentEpisode = episode;
  state.maxEpisode = Math.max(state.maxEpisode, episode);
  state.url = url;
  state.episodeUrls[episode] = url;
  player.src = url;
  player.load();
  player.addEventListener('loadedmetadata', () => {
    if (startTime > 0 && startTime < player.duration) player.currentTime = startTime;
  }, { once: true });
  await persistProgress();
  render();
}

function render() {
  if (!state) return;
  title.textContent = state.animeName;
  summary.textContent = `目前第 ${state.currentEpisode} 集，列表顯示 1～${state.maxEpisode} 集`;
  episodeList.textContent = '';
  for (let episode = 1; episode <= state.maxEpisode; episode += 1) {
    const button = document.createElement('button');
    button.textContent = `第 ${episode} 集`;
    button.className = episode === state.currentEpisode ? 'active' : '';
    button.addEventListener('click', () => playEpisode(episode, state.episodeUrls[episode] || buildEpisodeUrl(state.url, state.currentEpisode, episode, state.episodeWidth)));
    episodeList.append(button);
  }
  prevButton.disabled = state.currentEpisode <= 1;
}

function probeVideo(url) {
  return new Promise((resolve) => {
    const probe = document.createElement('video');
    const done = (exists) => {
      probe.removeAttribute('src');
      probe.load();
      resolve(exists);
    };
    probe.preload = 'metadata';
    probe.src = url;
    probe.addEventListener('loadedmetadata', () => done(true), { once: true });
    probe.addEventListener('error', () => done(false), { once: true });
    setTimeout(() => done(false), 10000);
  });
}

async function persistProgress() {
  if (!state) return;
  const lastTime = Number.isFinite(player.currentTime) ? player.currentTime : 0;
  await saveRecentWatch({
    ...state,
    episode: state.currentEpisode,
    currentEpisode: state.currentEpisode,
    lastTime,
    currentTime: lastTime,
    url: state.url
  });
}

prevButton.addEventListener('click', () => {
  if (!state || state.currentEpisode <= 1) return;
  const episode = state.currentEpisode - 1;
  playEpisode(episode, state.episodeUrls[episode] || buildEpisodeUrl(state.url, state.currentEpisode, episode, state.episodeWidth));
});

nextButton.addEventListener('click', async () => {
  if (!state) return;
  const nextEpisode = state.currentEpisode + 1;
  const nextUrl = buildEpisodeUrl(state.url, state.currentEpisode, nextEpisode, state.episodeWidth);
  statusText.textContent = '正在尋找下一集…';
  nextButton.disabled = true;
  const exists = await probeVideo(nextUrl);
  nextButton.disabled = false;
  if (exists) {
    statusText.textContent = '';
    await playEpisode(nextEpisode, nextUrl, 0);
  } else {
    statusText.textContent = '找不到下一集，已保持目前播放。';
  }
});

player.addEventListener('timeupdate', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistProgress, 500);
});
player.addEventListener('pause', persistProgress);
player.addEventListener('ended', persistProgress);
window.addEventListener('beforeunload', persistProgress);

init();
