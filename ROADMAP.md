# 路線圖

本文件是產品優先順序的單一來源，對應 [GitHub Issues](https://github.com/william563214/download_classify/issues)。

## 硬性產品規則

1. 分類與歸因分開處理。
2. 確認歸因或儲存規則不會搬移已下載檔，只影響紀錄與之後的下載。
3. 僅副檔名對照或啟發式命中仍算**未分類**（會觸發分類詢問）。
4. 資料僅存本機；`chrome.storage.sync`（若實作）僅同步瀏覽器設定／規則，不是上傳或雲端同步使用者下載檔。

## P0 品質／可上架

- [#1 P0: 跑通 build／typecheck／e2e，修壞掉的測試或腳本](https://github.com/william563214/download_classify/issues/1)
- [#2 P0: 檢查並補齊 i18n（en／zh_TW）](https://github.com/william563214/download_classify/issues/2)
- [#3 P0: 補齊圖示與 store 上架截圖素材](https://github.com/william563214/download_classify/issues/3)
- [#4 P0: 上架 zip 流程文件＋權限／隱私文一致性](https://github.com/william563214/download_classify/issues/4)

## P1 已知產品缺口

- [#5 P1: 規則衝突／優先序 UI 更清楚](https://github.com/william563214/download_classify/issues/5)
- [#6 P1: 可選「確認後搬移已下載檔」](https://github.com/william563214/download_classify/issues/6)
- [#7 P1: 完整設定匯出／匯入（含 rename、attribution）](https://github.com/william563214/download_classify/issues/7)
- [#8 P1: Chrome Web Store 適配（manifest／打包差異）](https://github.com/william563214/download_classify/issues/8)

## P2 體驗

- [#9 P2: 降低詢問疲勞（同站略過／批次規則／預填）](https://github.com/william563214/download_classify/issues/9)
- [#10 P2: Popup／歷史篩選、搜尋、待處理佇列](https://github.com/william563214/download_classify/issues/10)
- [#11 P2: 歸因候選品質（邊界案例與過期清理）](https://github.com/william563214/download_classify/issues/11)
- [#12 P2: 已知網盤清單可維護／預設擴充](https://github.com/william563214/download_classify/issues/12)

## P3 之後

- [#13 P3: 評估並精簡 ＜all_urls＞ content script 負擔](https://github.com/william563214/download_classify/issues/13)
- [#14 P3: chrome.storage.sync 同步規則（注意配額）](https://github.com/william563214/download_classify/issues/14)

## 協作備註

- 優先以 cloud-agent PR 推進各 issue
- 未經 owner 核准勿合併
- 隱私原則：資料僅存本機，不上傳外部；`storage.sync` ≠ 下載檔雲端同步

## 建議下一步

先從 [#1](https://github.com/william563214/download_classify/issues/1) 開始，讓 build／typecheck／e2e 全綠。
