# 測試計畫

本文件為約定測試設計。實作 Vitest／e2e 屬 [#1](https://github.com/william563214/download_classify/issues/1) 後續，本 PR 僅文件。

## 1. 現況

| 項目 | 狀態 |
|---|---|
| `npm run typecheck` / `npm run build` | 已有（`tsc --noEmit` + Vite） |
| `npm run test:e2e` | 指向 `.temp/`（已 gitignore），腳本與 fixtures 未必進版控 |
| `npm run test:serve` | 本機模擬站，同樣依賴 `.temp/` |
| 純邏輯 | `matcher`、`classifier`、`unclassified`、`filename` 等可單元測試 |
| 需瀏覽器 | 下載攔截、歸因／外連追蹤、content script、詢問彈窗 |

## 2. 設計原則

- **分類 ≠ 歸因**。確認歸因或儲存規則**不搬移**已下載檔（對照 [#6](https://github.com/william563214/download_classify/issues/6) 可選搬檔）。
- 測試順序：純函式 → service worker 訊息／storage → e2e。
- 模擬站用**固定本機網域**，不依賴真實站。
- e2e 使用乾淨 profile／臨時 `user-data-dir`，避免污染本機擴充設定。

## 3. 測試金字塔

| 層級 | 內容 | 工具 |
|---|---|---|
| L0 靜態 | `tsc --noEmit`、`vite build` | npm scripts |
| L1 單元 | matcher、classifier、unclassified、filename、規則優先序 | Vitest |
| L2 整合 | storage、messages、歸因候選組裝 | Vitest + chrome mock |
| L3 e2e | 載入 `dist` 擴充 + 本機模擬站 | Playwright |
| L4 手動／上架 | 權限、隱私文、截圖、zip 流程 | checklist（見 store／[#3](https://github.com/william563214/download_classify/issues/3)／[#4](https://github.com/william563214/download_classify/issues/4)） |

## 4. L1 必測案例

### matcher

- hostname／副檔名／basename 擷取
- `*` pattern、`host_matches_site`（含子網域）
- `is_known_file_host`

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

| ID | 路徑 | 預期 |
|---|---|---|
| E1 | 已設網站分類後下載 | 檔案進對應子資料夾；不彈分類詢問 |
| E2 | 未分類下載（提示開啟） | 完成後出現分類詢問 |
| E3 | 詢問中建規則後再下同站 | 後續命中規則；路徑正確 |
| E4 | 歸因詢問站 A→B | 顯示候選；確認後寫歸因；**不搬已下載檔** |
| E5 | 非歸因詢問站下載 | 不彈歸因詢問 |
| E6 | Popup 存當前網站分類 | 設定生效；後續下載走網站分類 |
| E7 | 設定頁 JSON 匯出 | 範圍僅規則三類；無 rename／attribution |

## 7. 建議目錄與 scripts

```
tests/
  unit/
  integration/
  e2e/
  fixtures/    # 模擬站與樣例檔（應可進版控，勿唯獨依賴 .temp/）
  helpers/
```

建議 npm scripts（[#1](https://github.com/william563214/download_classify/issues/1) 實作時落地）：

| script | 用途 |
|---|---|
| `test:unit` | Vitest L1（可含 L2） |
| `test:e2e` | Playwright；先 build，載入 `dist` |
| `test:serve` | 本機固定網域模擬站 |

現有 `test:e2e`／`test:serve` 指向 `.temp/` 者，遷移時改為以 `tests/` fixtures 為主。

## 8. 與 ROADMAP／Issues 對齊

| Issue | 對齊點 |
|---|---|
| [#1](https://github.com/william563214/download_classify/issues/1) | 綠燈：build／typecheck／單元／e2e 腳本與路徑 |
| [#2](https://github.com/william563214/download_classify/issues/2) | i18n：en／zh_TW key 對稱；可做靜態或缺 key 檢查 |
| [#6](https://github.com/william563214/download_classify/issues/6) | 搬檔：現況測試須斷言「確認不搬」；日後可選搬檔另加案例 |

## 9. #1 成功標準

- [ ] `npm run typecheck` 與 `npm run build` 通過
- [ ] `npm run test:unit` 覆蓋 matcher／classifier／unclassified／filename／優先序等核心
- [ ] `npm run test:e2e` 至少覆蓋 **E1–E4**
- [ ] fixtures／腳本不**唯獨**依賴被 gitignore 的 `.temp/`（可複製或改放 `tests/fixtures`）
