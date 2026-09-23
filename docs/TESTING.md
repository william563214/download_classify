# 測試計畫

本文件為約定測試設計與執行說明（**以此為準**；[PR #16](https://github.com/william563214/download_classify/pull/16) 僅文件草案已關閉／由本文件承接）。對齊 [#1](https://github.com/william563214/download_classify/issues/1)。

## 0. 資料僅本機／不上傳

- 擴充功能執行期資料（規則、設定、下載紀錄、歸因暫存）**只寫本機**瀏覽器儲存（`chrome.storage`／IndexedDB），**不上傳**外部伺服器。詳見 README「隱私」與 [`store/PRIVACY.md`](../store/PRIVACY.md)。
- 測試同樣不需雲端：模擬站與 fixtures 在本機 `tests/`；e2e 使用臨時 `user-data-dir`。
- **`.temp/`**：僅本機開發／除錯用暫存目錄（已 gitignore）。**不是**雲端路徑、**不是**正式 fixtures 來源。版控以 `tests/fixtures`／`tests/helpers` 為準；可選把本機 scratch 放進 `.temp/`，CI 與乾淨 clone **不依賴**它。

## 1. 現況

| 項目 | 狀態 |
|---|---|
| `npm run typecheck` / `npm run build` | 通過（`tsc --noEmit` + Vite） |
| `npm run test:unit` | Vitest；覆蓋 matcher／classifier／unclassified／filename |
| `npm run test:e2e` | Playwright；先 build，載入 `dist/`，fixtures 在 `tests/` |
| `npm run test:serve` | 本機模擬站（`tests/helpers/serve_mock_sites.mjs`） |
| 純邏輯 | `matcher`、`classifier`、`unclassified`、`filename` 等已單元測試 |
| 需瀏覽器 | 下載攔截、歸因／外連追蹤、content script、詢問彈窗 |

## 2. 設計原則

- **分類 ≠ 歸因**。確認歸因或儲存規則**不搬移**已下載檔（對照 [#6](https://github.com/william563214/download_classify/issues/6) 可選搬檔）。
- 測試順序：純函式 → service worker 訊息／storage → e2e。
- 模擬站用**固定本機網域**（`fantia.test` / `fanbox.test` / `mega.test` / `forum.test` → `127.0.0.1`），不依賴真實站、不上傳。
- e2e 使用乾淨 profile／臨時 `user-data-dir`，避免污染本機擴充設定。

## 3. 測試金字塔

| 層級 | 內容 | 工具 |
|---|---|---|
| L0 靜態 | `tsc --noEmit`、`vite build` | npm scripts |
| L1 單元 | matcher、classifier、unclassified、filename、規則優先序 | Vitest |
| L2 整合 | storage、messages、歸因候選組裝 | Vitest + chrome mock（建議後續） |
| L3 e2e | 載入 `dist` 擴充 + 本機模擬站 | Playwright（Chromium） |
| L4 手動／上架 | 權限、隱私文、截圖、zip 流程 | checklist（見 store／[#3](https://github.com/william563214/download_classify/issues/3)／[#4](https://github.com/william563214/download_classify/issues/4)） |

## 4. L1 必測案例

### matcher

- hostname／副檔名／basename 擷取
- `*` pattern、`host_matches_site`（含子網域）
- `is_known_file_host`、`urls_related`

### 分類優先序（對齊 README 1–5）

1. 網站分類命中即停
2. 自定義規則（同規則多條件 **OR**）
3. 副檔名對照
4. 啟發式 fallback
5. `Others/`

### 未分類定義

- 未命中網站分類
- 未命中含網域條件的自定義規則
- 僅命中副檔名或啟發式 → **仍算未分類**（會觸發分類詢問）

### 檔名

- `apply_rename` 前綴／後綴與分隔符
- `build_classified_path` 資料夾 + 更名組合

## 5. L2 建議案例

- `chrome.storage.local`／`session` 讀寫與預設合併
- service worker 訊息：存網站分類、建立規則、歸因確認
- 歸因候選：外連點擊、導覽鏈、referrer、下載站 fallback；過期剔除
- 匯出 JSON：僅 `rules`／`site_rules`／`extension_rules`，不含 rename／attribution
- **確認歸因／存規則不觸發搬檔**（對照 [#6](https://github.com/william563214/download_classify/issues/6)）

## 6. L3 e2e 關鍵路徑（E1–E7）

| ID | 路徑 | 預期 | 自動化 |
|---|---|---|---|
| E1 | 已設網站分類後下載 | 檔案進對應子資料夾；不彈分類詢問 | `tests/e2e/e1-e4.spec.ts` |
| E2 | 未分類下載（提示開啟） | 完成後出現分類詢問 | 同上 |
| E3 | 詢問中建規則後再下同站 | 後續命中規則；**存規則不搬已下載檔** | `tests/e2e/e1-e4.spec.ts`（硬斷言） |
| E4 | 歸因詢問站 A→B | 顯示候選；確認後寫歸因；**不搬已下載檔** | 同上（硬斷言，不可軟過） |
| E5 | 非歸因詢問站下載 | 不彈歸因詢問 | 暫緩：非 #1 P0 硬規則；追蹤後續 issue／PR |
| E6 | Popup 存當前網站分類 | 設定生效；後續下載走網站分類 | 暫緩：同上 |
| E7 | 設定頁 JSON 匯出 | 範圍僅規則三類；無 rename／attribution | 暫緩：同上 |

## 7. 目錄與 scripts

```
tests/
  unit/          # L1（可擴充含 L2）
  integration/   # 建議後續：L2 chrome mock（尚未必備）
  e2e/
  fixtures/      # fantia / fanbox / mega / forum（版控；勿唯獨依賴 .temp/）
  helpers/       # extension 啟動、mock server
```

| 路徑 | 用途 |
|---|---|
| `tests/` | **正式**測試與 fixtures（進版控） |
| `.temp/` | **本機 scratch only**（gitignore；除錯／實驗輸出；非雲端、非 CI 依賴） |

| script | 用途 |
|---|---|
| `test:unit` | Vitest L1（日後可含 L2） |
| `test:e2e` | `scripts/run-e2e.sh`：先 build，再 Playwright 載入 `dist` |
| `test:serve` | 本機固定網域模擬站（預設埠 `18765`） |
| `install:edge` | build 後提示於 Edge 手動載入 `dist/` |

### 顯示／xvfb（不要硬綁）

| 環境 | 行為 |
|---|---|
| 已有 `DISPLAY`（本機 GUI、macOS／Windows 桌面） | 直接 `playwright test` |
| `E2E_HEADED=1` | 強制 headed |
| Linux 無 `DISPLAY` 且有 `xvfb-run` | 自動 `xvfb-run -a playwright test` |
| 其他（無 xvfb） | 嘗試 `headless=new`；若擴充載入失敗再安裝 xvfb |

CI（`.github/workflows/ci.yml`）在 Ubuntu 安裝 xvfb 後跑 e2e；`typecheck`／`build`／`test:unit` 為必跑。

### 模擬站網域

Chrome 啟動參數會把下列主機指到 `127.0.0.1`：

- `fantia.test` / `fanbox.test` / `mega.test` / `forum.test`

### 不搬檔硬斷言（E3／E4）

確認歸因或儲存規則之後，測試必須：

1. 取得動作前 `chrome.downloads` 的 `id` + 非空 `filename`
2. 動作後同一 `id` 的 `filename` **完全相同**（不可 `if` 軟過）
3. probe 未呼叫 `chrome.downloads.move`／`erase`
4. Playwright `saveAs` 副本仍存在且大小不變

### Edge／其他限制

- 自動化路徑以 **Chromium 擴充功能載入** 為準
- Microsoft Edge：`npm run install:edge` 手動載入 `dist/`（無 Edge 的 CI／VM 未驗證）
- Playwright 可能攔截下載串流，分類結果以 IndexedDB 紀錄為準；**不搬檔**仍以 `chrome.downloads.filename` 前後相等為硬條件

## 8. 與 ROADMAP／Issues 對齊

| Issue | 對齊點 |
|---|---|
| [#1](https://github.com/william563214/download_classify/issues/1) | 綠燈：build／typecheck／單元／e2e 腳本與路徑 |
| [#2](https://github.com/william563214/download_classify/issues/2) | i18n：en／zh_TW key 對稱；可做靜態或缺 key 檢查 |
| [#6](https://github.com/william563214/download_classify/issues/6) | 搬檔：現況測試須斷言「確認不搬」；日後可選搬檔另加案例 |

## 9. #1 成功標準

- [x] `npm run typecheck` 與 `npm run build` 通過
- [x] `npm run test:unit` 覆蓋 matcher／classifier／unclassified／filename／優先序等核心
- [x] `npm run test:e2e` 至少覆蓋 **E1–E4**（含 E3／E4 **不搬檔硬斷言**；腳本與 fixtures 已進版控）
- [x] fixtures／腳本不**唯獨**依賴被 gitignore 的 `.temp/`（正式路徑為 `tests/`）
- [x] 文件明示：**資料僅本機／不上傳**；`.temp/` 僅本機 scratch
