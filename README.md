# 下載分類助手

Microsoft Edge 擴充功能：攔截下載、依規則分類到子資料夾、追蹤來源，並在需要時詢問分類與歸因。

## 快速開始

```bash
npm install
npm run build
```

於 `edge://extensions` 啟用開發人員模式，載入 `dist/` 目錄。

## 核心概念

本擴充功能將 **分類**（存到哪個資料夾）與 **歸因**（來源記錄為哪個網站）分開處理：

| 概念 | 說明 |
|---|---|
| **分類** | 決定下載檔案的子資料夾路徑（`onDeterminingFilename` 時套用） |
| **歸因** | 決定紀錄中的 `attributed_site` 與可選的檔名網域前綴 |
| **分類詢問** | 下載完成後彈窗，可建立規則（適用所有網站） |
| **歸因詢問** | 僅在「歸因詢問網站」下載完成後，彈窗選擇 A→B 來源 |

**重要**：確認歸因或儲存規則**不會搬移**已下載的檔案，只影響紀錄與之後的下載。

## 分類優先順序

下載當下依序匹配，命中即停止：

1. **網站分類**（設定頁或 Popup 快速設定）
2. **自定義分類規則**（進階；同一規則內多條件為 **OR**）
3. **副檔名對照表**
4. **啟發式 fallback**（來源網域 → 頁面路徑 → 檔名）
5. `Others/`

### 何謂「未分類」（會觸發分類詢問）

- 未命中 **網站分類**
- 未命中含 **網域條件**（來源站、下載站、來源頁）的 **自定義規則**
- 僅命中副檔名對照或啟發式分類 → **仍算未分類**，會詢問

## 歸因邏輯

### 平常下載（所有網站）

下載當下解析來源，優先順序：

1. 發起下載的分頁網域（`tabId` + 分頁導覽紀錄）
2. HTTP `referrer`
3. 下載 URL 的網域（fallback）

**不會**自動將 A 站（論壇）套用到 B 站（網盤）下載。

### 歸因詢問（僅指定網站）

預設詢問站：`mega.nz`、`mediafire.com`、`drive.google.com`、`dropbox.com`、`pan.baidu.com`

在這些網站完成下載後，詢問頁顯示候選來源：

- 外連點擊紀錄（A 站點擊到 B 站）
- 分頁導覽鏈（A 站導覽到 B 站）
- referrer、下載站 fallback

使用者確認後才寫入 A→B 歸因。

### 外連點擊追蹤

Content Script 記錄：

- 跨站外連點擊
- 同站連到「已知網盤網域」的連結

有效期限由 **待歸因有效時間** 控制（與 session 暫存一致）。

## 使用者介面

| 介面 | 功能 |
|---|---|
| **Popup** | 當前網站分類狀態、快速儲存網站分類、待分類下載、統計 |
| **設定頁** | 完整規則、歸因、檔名、歷史匯入、JSON 匯出 |
| **詢問頁** | 歸因選擇 + 建立分類規則 |

## 設定項目

| 設定 | 效果 |
|---|---|
| 未分類提示 | 控制分類詢問彈窗 |
| 檔名加網域 | 在檔名加 `attributed_site` 前綴或後綴 |
| 待歸因有效時間 | 外連點擊暫存與歸因候選有效期 |
| 已知網盤網域 | Content Script 追蹤哪些網盤連結 |
| 歸因詢問開關 / 網站清單 | 控制 A→B 歸因詢問 |
| 網站分類 | 依網域指定資料夾（優先於自定義規則） |
| 自定義規則 | 多條件進階匹配 |
| 副檔名對照 | 依副檔名分資料夾 |

規則 JSON 匯出包含 `rules`、`site_rules`、`extension_rules`，不含 rename / attribution 設定。

## 權限

| 權限 | 用途 |
|---|---|
| `downloads` | 攔截下載、建議存檔路徑與檔名 |
| `storage` | 規則與設定（local + session） |
| `tabs` | 取得下載分頁、opener 追蹤 |
| `webNavigation` | 同分頁 A→B 導覽鏈 |
| `windows` | 開啟詢問彈窗 |
| `<all_urls>` | Content Script 追蹤外連點擊 |

## 資料儲存

| 資料 | 位置 |
|---|---|
| 設定、規則 | `chrome.storage.local` |
| 外連點擊、分頁脈絡、歸因候選 | `chrome.storage.session` |
| 下載紀錄 | IndexedDB `download_classify_db` |

## 開發

測試計畫見 [`docs/TESTING.md`](docs/TESTING.md)。

```bash
npm run dev          # 監聽建置
npm run test:e2e     # Playwright 測試
npm run test:serve   # 本機模擬站
npm run install:edge # 安裝到 Edge
```

模擬站路徑見 `.temp/tests/fixtures/`（Fantia / FANBOX / MEGA 等）。

## 隱私

所有資料僅存本機，不上傳外部伺服器。詳見 `store/PRIVACY.md`。

## 上架

素材位於 `store/`，見 `store/README.md`。
