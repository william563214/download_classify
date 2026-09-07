import type { CurrentSiteStatus, DownloadRecord, SiteMatchTarget } from "../shared/types";
import { format_match_role } from "../shared/site-status";

async function get_current_site_status(): Promise<CurrentSiteStatus> {
  return (await chrome.runtime.sendMessage({
    type: "GET_CURRENT_SITE_STATUS",
  })) as CurrentSiteStatus;
}

function status_badge(ok: boolean, yes_text: string, no_text: string): string {
  const klass = ok ? "status-yes" : "status-no";
  const label = ok ? yes_text : no_text;
  return `<span class="status-badge ${klass}">${label}</span>`;
}

function fill_site_classify_form(status: CurrentSiteStatus): void {
  const form = document.getElementById("site-classify-form");
  if (!form || status.unsupported_page) {
    form?.classList.add("hidden");
    return;
  }

  form.classList.remove("hidden");

  const rule = status.site_rule;
  const name_input = document.getElementById("site-rule-name") as HTMLInputElement;
  const folder_input = document.getElementById("site-rule-folder") as HTMLInputElement;
  const match_select = document.getElementById("site-rule-match-target") as HTMLSelectElement;
  const id_input = document.getElementById("site-rule-id") as HTMLInputElement;
  const host_input = document.getElementById("site-rule-host") as HTMLInputElement;

  name_input.value = rule?.name ?? status.hostname;
  folder_input.value = rule?.target_folder ?? status.fallback_folder;
  match_select.value = rule?.match_target ?? "source";
  id_input.value = rule?.id ?? "";
  host_input.value = status.hostname;
}

function render_current_site(status: CurrentSiteStatus): void {
  const host_el = document.getElementById("current-site-host");
  const classification_el = document.getElementById("current-site-classification");
  const attribution_el = document.getElementById("current-site-attribution");

  if (!host_el || !classification_el || !attribution_el) {
    return;
  }

  if (status.unsupported_page) {
    host_el.textContent = "無法分析此頁面";
    classification_el.innerHTML = '<p class="site-note">僅支援 http/https 網頁</p>';
    attribution_el.innerHTML = "";
    fill_site_classify_form(status);
    return;
  }

  const title_suffix = status.page_title ? ` · ${status.page_title}` : "";
  host_el.textContent = `${status.hostname}${title_suffix}`;

  if (status.classification_matches.length) {
    const items = status.classification_matches
      .map((match) => {
        const kind_label = match.kind === "site" ? "網站分類" : "自定義規則";
        return `<li>
          <span class="status-badge status-yes">已設定</span>
          <strong>${escape_html(match.name)}</strong>
          <span class="site-meta">${escape_html(kind_label)} · ${escape_html(format_match_role(match.match_role))}</span>
          <span class="site-folder">→ ${escape_html(match.target_folder)}</span>
        </li>`;
      })
      .join("");
    classification_el.innerHTML = `
      <div class="site-status-title">目前規則</div>
      <ul class="site-status-list">${items}</ul>`;
  } else {
    classification_el.innerHTML = `
      <div class="site-status-title">目前規則</div>
      <p class="site-line">
        ${status_badge(false, "", "未設定")}
        <span class="site-meta">下載將暫存至 ${escape_html(status.fallback_folder)}</span>
      </p>`;
  }

  fill_site_classify_form(status);

  const attribution_items: string[] = [];

  if (status.link_trace_enabled) {
    attribution_items.push(`
      <li>
        ${status_badge(true, "點擊追蹤", "")}
        <span class="site-meta">外連點擊會暫存，僅在歸因詢問站下載後可選為 A 站來源</span>
      </li>`);
  }

  if (status.attribution_inquiry) {
    attribution_items.push(`
      <li>
        ${status_badge(true, "歸因詢問", "")}
        <span class="site-meta">在此站下載完成後會詢問來源歸因</span>
      </li>`);
  }

  if (status.known_file_host) {
    attribution_items.push(`
      <li>
        ${status_badge(true, "網盤站", "")}
        <span class="site-meta">列為已知下載站，可被來源站追溯</span>
      </li>`);
  }

  if (!status.attribution_inquiry && !status.known_file_host) {
    attribution_items.push(`
      <li>
        ${status_badge(true, "當前頁歸因", "")}
        <span class="site-meta">從此頁下載以當前網站為來源</span>
      </li>`);
  }

  attribution_el.innerHTML = `
    <div class="site-status-title">歸因</div>
    <ul class="site-status-list">${attribution_items.join("")}</ul>`;
}

async function save_site_classification(event: Event): Promise<void> {
  event.preventDefault();

  const status_el = document.getElementById("site-save-status");
  const name = (document.getElementById("site-rule-name") as HTMLInputElement).value;
  const target_folder = (document.getElementById("site-rule-folder") as HTMLInputElement).value;
  const match_target = (document.getElementById("site-rule-match-target") as HTMLSelectElement)
    .value as SiteMatchTarget;
  const id = (document.getElementById("site-rule-id") as HTMLInputElement).value;
  const host = (document.getElementById("site-rule-host") as HTMLInputElement).value;

  const result = (await chrome.runtime.sendMessage({
    type: "SAVE_SITE_CLASSIFICATION",
    payload: {
      id: id || undefined,
      name,
      host,
      target_folder,
      match_target,
    },
  })) as { ok: boolean; error?: string };

  if (status_el) {
    status_el.textContent = result.ok ? "已儲存" : (result.error ?? "儲存失敗");
    status_el.className = result.ok ? "site-save-status ok" : "site-save-status error";
  }

  if (result.ok) {
    const refreshed = await get_current_site_status();
    render_current_site(refreshed);
    setTimeout(() => {
      if (status_el) {
        status_el.textContent = "";
      }
    }, 2000);
  }
}

async function get_unclassified_downloads(): Promise<DownloadRecord[]> {
  return (await chrome.runtime.sendMessage({
    type: "GET_UNCLASSIFIED_DOWNLOADS",
  })) as DownloadRecord[];
}

function confidence_label(confidence: DownloadRecord["attribution_confidence"]): string {
  switch (confidence) {
    case "high":
      return "高";
    case "medium":
      return "中";
    default:
      return "低";
  }
}

function confidence_class(confidence: DownloadRecord["attribution_confidence"]): string {
  return `badge badge-${confidence}`;
}

function render_stats(stats: Record<string, number>): void {
  const list = document.getElementById("stats-list");
  if (!list) {
    return;
  }

  const entries = Object.entries(stats);
  if (!entries.length) {
    list.innerHTML = '<li class="empty">今日尚無下載紀錄</li>';
    return;
  }

  list.innerHTML = entries
    .map(
      ([category, count]) =>
        `<li><span>${escape_html(category)}</span><span>${count}</span></li>`
    )
    .join("");
}

function render_unclassified(records: DownloadRecord[]): void {
  const section = document.getElementById("unclassified-section");
  const list = document.getElementById("unclassified-list");
  if (!section || !list) {
    return;
  }

  if (!records.length) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  list.innerHTML = records
    .slice(0, 10)
    .map(
      (record) => `
      <li class="unclassified-item">
        <div class="filename">${escape_html(record.filename)}</div>
        <div class="meta">
          ${escape_html(record.category)} → ${escape_html(record.target_folder)}
          · 來源 ${escape_html(record.attributed_site || "-")}
        </div>
        <button type="button" class="classify-btn" data-download-id="${record.download_id}">
          設定規則
        </button>
      </li>`
    )
    .join("");

  list.querySelectorAll(".classify-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const download_id = Number((button as HTMLButtonElement).dataset.downloadId);
      void chrome.runtime.sendMessage({
        type: "OPEN_CLASSIFY_PROMPT",
        download_id,
      });
    });
  });
}

function render_recent(records: DownloadRecord[]): void {
  const list = document.getElementById("recent-list");
  if (!list) {
    return;
  }

  if (!records.length) {
    list.innerHTML = '<li class="empty">尚無下載紀錄</li>';
    return;
  }

  list.innerHTML = records
    .map((record) => {
      const imported = record.imported ? " · 歷史匯入" : "";
      const unclassified = record.is_unclassified ? ' <span class="badge badge-low">未分類</span>' : "";
      return `<li>
        <div class="filename">${escape_html(record.filename)}</div>
        <div class="meta">
          ${escape_html(record.category)} → ${escape_html(record.target_folder)}
          · 來源 ${escape_html(record.attributed_site || "-")}
          <span class="${confidence_class(record.attribution_confidence)}">${confidence_label(record.attribution_confidence)}</span>
          ${unclassified}
          ${imported}
        </div>
      </li>`;
    })
    .join("");
}

function escape_html(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function load_popup(): Promise<void> {
  const { get_recent_downloads, get_today_category_stats } = await import("../shared/storage");
  const [site_status, stats, recent, unclassified] = await Promise.all([
    get_current_site_status(),
    get_today_category_stats(),
    get_recent_downloads(20),
    get_unclassified_downloads(),
  ]);
  render_current_site(site_status);
  render_unclassified(unclassified);
  render_stats(stats);
  render_recent(recent);
}

document.getElementById("open-options")?.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById("site-classify-form")?.addEventListener("submit", (event) => {
  void save_site_classification(event);
});

void load_popup();
