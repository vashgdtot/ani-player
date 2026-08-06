# Ani MP4 Player

Chrome Manifest V3 擴充套件，用來輸入 MP4 資源網址、解析動畫名稱與集數，並在 `viewer.html` 使用原生 HTML5 `<video controls>` 播放器播放。

## 讓其他 HTML5 / video 擴充套件在播放器起作用

`viewer.html` 是本擴充套件內部頁面，網址會是 `chrome-extension://<extension-id>/viewer.html`。多數第三方 HTML5 影片擴充套件是透過 content script 注入一般網頁運作，而 Chrome 的 content script match pattern 只支援 `http`、`https`、`file` 與有限的特殊樣式；一般第三方擴充套件不能直接注入另一個擴充套件的 `chrome-extension://` 頁面。因此，其他 HTML5 影片擴充套件通常不會在本專案的 `viewer.html` 生效。

可行做法有三種：

1. 直接把需要的播放控制功能實作在本專案的 `viewer.js`，這是最穩定的做法，因為程式碼與播放器在同一個擴充套件頁面中執行。
2. 如果只需要第三方擴充套件處理原始影片頁，請直接開啟 MP4 URL 本身；這會離開本專案的側邊集數列表與最近觀看功能，但第三方擴充套件較有機會在一般 `https://` 頁面上注入。
3. 若你能修改那個第三方擴充套件，只能嘗試讓它支援本擴充套件頁面或改成與本擴充套件整合；已發布的第三方擴充套件通常無法由本專案單方面強制啟用。

本專案目前採用第一種策略：使用原生 `<video controls>`，並把上一集、下一集、進度保存、最近觀看等功能做在本擴充套件內。

## 可以把 `chrome-extension://.../viewer.html` 變成 localhost 嗎？

不能把同一個擴充套件內部頁面「改寫」成正常的 `http://localhost/...` URL；`chrome-extension://` 是 Chrome 載入擴充套件封裝檔案時使用的固定來源。若要讓網址變成 `localhost`，必須另外用本機 HTTP 伺服器提供一份播放器頁面，例如 `http://localhost:5173/viewer.html`。

可行架構如下：

1. 保留 Chrome extension 的 popup 與 storage 功能。
2. 另外建立或啟動本機靜態伺服器來提供播放器頁面。
3. Popup 按下「開啟播放器」時改開 `http://localhost:<port>/viewer.html?...`，並用 query string、`postMessage`、本機 API 或 Native Messaging 把影片 URL 與播放資訊交給 localhost 頁面。

限制與代價：

- Chrome MV3 擴充套件本身不能像 Node.js 一樣直接開一個 HTTP server 監聽 localhost port。
- 如果使用 localhost 播放器，`chrome.storage.local` 不能直接在 localhost 頁面使用；最近觀看與進度需要改用 query string、localStorage、後端 API，或由 extension 與頁面通訊同步。
- 若目標是讓其他第三方 HTML5 擴充套件能注入播放器，localhost 方案較有機會，因為它是一般 `http://localhost` 網頁；但仍取決於該第三方擴充套件的 host permissions 與 content script 規則。

因此，本專案若要支援 localhost 模式，建議新增一個「外部播放器模式」設定：預設維持目前的 `chrome-extension://.../viewer.html`，需要第三方擴充套件注入時再讓使用者自行啟動 localhost viewer。
