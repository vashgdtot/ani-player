# Ani MP4 Player

Chrome Manifest V3 擴充套件，用來輸入 MP4 資源網址、解析動畫名稱與集數，並在 `viewer.html` 使用原生 HTML5 `<video controls>` 播放器播放。

## 讓其他 HTML5 / video 擴充套件在播放器起作用

`viewer.html` 是本擴充套件內部頁面，網址會是 `chrome-extension://<extension-id>/viewer.html`。多數第三方 HTML5 影片擴充套件是透過 content script 注入一般網頁運作，而 Chrome 的 content script match pattern 只支援 `http`、`https`、`file` 與有限的特殊樣式；一般第三方擴充套件不能直接注入另一個擴充套件的 `chrome-extension://` 頁面。因此，其他 HTML5 影片擴充套件通常不會在本專案的 `viewer.html` 生效。

可行做法有三種：

1. 直接把需要的播放控制功能實作在本專案的 `viewer.js`，這是最穩定的做法，因為程式碼與播放器在同一個擴充套件頁面中執行。
2. 如果只需要第三方擴充套件處理原始影片頁，請直接開啟 MP4 URL 本身；這會離開本專案的側邊集數列表與最近觀看功能，但第三方擴充套件較有機會在一般 `https://` 頁面上注入。
3. 若你能修改那個第三方擴充套件，只能嘗試讓它支援本擴充套件頁面或改成與本擴充套件整合；已發布的第三方擴充套件通常無法由本專案單方面強制啟用。

本專案目前採用第一種策略：使用原生 `<video controls>`，並把上一集、下一集、進度保存、最近觀看等功能做在本擴充套件內。
