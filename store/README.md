# Edge Add-ons 上架素材

## 套件打包

```bash
npm run build
cd dist && zip -r ../store/download-classify.zip .
```

## 圖示

擴充功能圖示（`manifest` / toolbar）：

| 檔案 | 尺寸 | 用途 |
|---|---|---|
| `public/icons/icon16.png` | 16×16 | toolbar / favicon |
| `public/icons/icon32.png` | 32×32 | Windows / Retina toolbar |
| `public/icons/icon48.png` | 48×48 | 擴充功能管理頁 |
| `public/icons/icon128.png` | 128×128 | Chrome / Edge 套件圖示 |
| `public/icons/icon.svg` | 向量原稿 | 重新匯出 PNG 用 |

商店 logo（Edge Add-ons 常見要求）：

| 檔案 | 尺寸 |
|---|---|
| `store/icons/icon300.png` | 300×300 |

圖示為自製「下載箭頭 + 資料夾／分類」標記，無第三方商標。

重新產生 PNG（可選）：

```bash
uv run --with playwright python -m playwright install chromium
uv run --with playwright python .temp/scripts/render_icons.py
```

## 螢幕截圖

路徑：`store/screenshots/`，尺寸 1280×800（Edge 建議常見規格）。

| 檔案 | 內容 |
|---|---|
| `store/screenshots/01-popup-site-classify.png` | Popup 當前網站分類與快速設定 |
| `store/screenshots/02-popup-recent-stats.png` | Popup 最近下載與今日統計 |
| `store/screenshots/03-options-rules.png` | Options 網站分類與自定義規則 |
| `store/screenshots/04-prompt-classify-attribution.png` | 詢問頁（分類 + 歸因） |
| `store/screenshots/05-explorer-classified.png` | 下載後檔案已分類至子資料夾 |

**來源說明**：本批截圖為依實際 UI 樣式製作的靜態 mock（非瀏覽器 live 擴充功能擷取），內容對應真實介面與本機隱私承諾，不含上傳／遙測。

重新產生截圖（可選）：

```bash
uv run --with playwright python -m playwright install chromium
uv run --with playwright python .temp/scripts/capture_store_screenshots.py
```

## 商店描述（繁體中文）

**名稱**：下載分類助手

**簡短說明**：依網站與規則自動分類下載，並可選擇性追蹤 A→B 來源。

**完整說明**：

下載分類助手在您下載檔案時，依規則將檔案存入對應子資料夾，並記錄來源網站。

主要功能：

- **網站分類**：為特定網域指定目標資料夾（Popup 可快速設定）
- **自定義規則**：依來源站、下載站、檔名、副檔名等條件分類
- **副檔名對照**：常見副檔名自動分類
- **分類詢問**：未命中網站/網域規則時，下載完成後提示建立規則
- **歸因詢問**：在指定網盤站下載時，可選擇實際來源（A→B），確認後才套用
- **檔名標記**：可選在檔名加上來源網域
- **歷史匯入**：匯入瀏覽器既有下載紀錄供查閱

平常下載以當前頁面為來源，不會自動將論壇來源套用到網盤下載。A→B 歸因僅在您於詢問頁確認後寫入紀錄。

隱私承諾：所有資料僅儲存於本機，不會上傳至任何伺服器。

## 權限說明（提交審核用）

- **downloads**：攔截下載，依規則建議存檔路徑與檔名
- **storage**：本機儲存規則與下載紀錄
- **tabs**：取得發起下載的分頁，追蹤來源
- **webNavigation**：記錄同分頁導覽，輔助歸因候選
- **windows**：開啟分類/歸因詢問彈窗
- **所有網站**：輕量 Content Script 記錄外連點擊，不修改網頁內容

## 隱私政策摘要

不收集、不傳輸、不出售個人資料。規則與紀錄存於 `chrome.storage` 與 IndexedDB。

## 審核注意事項

- `<all_urls>` 僅用於外連點擊追蹤，非資料收集
- 強調資料僅存本機
- A→B 歸因需使用者於詢問頁確認，非自動套用
