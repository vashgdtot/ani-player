const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = { URL };
vm.createContext(context);
vm.runInContext(`${fs.readFileSync('common.js', 'utf8')}\nthis.parseMp4Url = parseMp4Url; this.buildEpisodeUrl = buildEpisodeUrl;`, context);

const aniUrl = 'https://resources.ani.rip/2026-7/%5BANi%5D%20%E5%BE%9E%200%20%E4%BD%8D%E5%B1%85%E6%B0%91%E9%96%8B%E5%A7%8B%E7%9A%84%E9%82%8A%E5%A2%83%E9%A0%98%E4%B8%BB%E5%A4%A7%E4%BA%BA%20-%2006%20%5B1080P%5D%5BBaha%5D%5BWEB-DL%5D%5BAAC%20AVC%5D%5BCHT%5D.mp4';
const parsedAni = context.parseMp4Url(aniUrl);
assert.strictEqual(parsedAni.animeName, '從 0 位居民開始的邊境領主大人');
assert.strictEqual(parsedAni.episode, 6);
assert.strictEqual(parsedAni.episodeWidth, 2);

const aniRipUrl = 'https://resources.ani.rip/2026-7/%5BANi%5D%20%E7%9B%9C%E5%A2%93%E7%8E%8B%20-%2005%20%5B1080P%5D%5BBaha%5D%5BWEB-DL%5D%5BAAC%20AVC%5D%5BCHT%5D?d=mp4';
const parsedAniRip = context.parseMp4Url(aniRipUrl);
assert.strictEqual(parsedAniRip.animeName, '盜墓王');
assert.strictEqual(parsedAniRip.episode, 5);
assert.match(context.buildEpisodeUrl(aniRipUrl, 5, 6, 2), /06/);

console.log('parser tests passed');
