# 鋼鐵原料價格觀測站

台灣與國際鋼鐵原料的繁體中文網頁儀表板，可篩選品項、切換歷史期間、查看新聞，並輸出 A4 報表。

## 功能

- 35 個價格／盤價序列、11,552 筆歷史觀測；可用資料最早回溯至 2016 年。
- 原料、國際鋼材、台灣市場、鋼廠開盤的折線圖與歷史明細。
- 國際行情、成本與供需、台灣鋼廠開盤消息，附來源連結。
- A4 列印／另存 PDF：沿用篩選條件，可選總表、折線圖與新聞，內容超過一頁自動分頁。

## 資料狀態

已加入 GitHub Actions，每 4 小時（台灣時間 00:25、04:25、08:25、12:25、16:25、20:25） 排程抓取（平台可能延遲）。網站顯示每次檢查結果。各序列實際截止日不同；尚未取得的歷史資料不補值。鋼廠「調整額」不是完整售價，0 代表平盤。資料來源、頻率、單位與限制見網頁及 JSON。新聞為摘要，原始內容與資料權利屬各來源。

## GitHub Pages 部署

1. 把此資料夾內容上傳到 GitHub 儲存庫的 `main` 分支，保留 `docs` 資料夾結構。
2. 開啟儲存庫 **Settings → Pages**。
3. Source 選 **Deploy from a branch**，Branch 選 **main**，資料夾選 **/docs**，按 Save。
4. 等候部署完成，使用 Pages 畫面顯示的網址。

網站使用相對路徑，可放在 GitHub Pages 專案子路徑；不需要 Node 建置、API 金鑰或付費服務。GitHub Pages 網站通常公開可見。

官方說明：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## 本機預覽與檢查

在此資料夾執行 `python -m http.server 8000 --directory docs`，開啟 http://localhost:8000 。請透過 HTTP 預覽，以便載入 JSON。

安裝 Node.js 後，執行 `node validate.mjs` 可檢查資料與主要互動。

## 更新資料

- `docs/data.json`：更新 `asOf` 與相關序列的 `points`；日期應遞增、不可重複，保留來源、單位與頻率。
- `docs/news.json`：更新整理日與新聞列表，保留原文連結、發布日、適用期間、分類與摘要。
- 執行檢查後提交 `main`；Pages 會重新發布。`scripts/update.py` 會取得價格來源及 Google News RSS 標題，合併歷史資料並保留來源失敗時的舊值。中鋼、燁聯、唐榮的調整額仍須人工核對，未自動推測新聞中的數值。自動收錄新聞標示待核對。

排程會直接部署 Pages 並維持 `/docs/` 網址，也支援 Actions → Update prices and news → Run workflow 手動執行。公開儲存庫長期無活動時 GitHub 可能停用排程，請定期查看 Actions。

## 列印

先選品項、期間或新聞條件，再按 **A4 列印／另存 PDF**。列印設定使用 A4、直向、100% 縮放；可關閉瀏覽器預設頁首與頁尾。取消歷史折線圖可縮短報表。
