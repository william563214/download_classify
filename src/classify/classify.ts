import { extract_extension } from "../shared/matcher";
import { apply_document_i18n, t } from "../shared/i18n";
import { suggest_rule_defaults } from "../shared/rule-builder";
import type { AttributionCandidate } from "../shared/attribution-candidate";
import type { DownloadRecord } from "../shared/types";

let current_download_id = 0;
let has_attribution_inquiry = false;
let needs_classification = false;
let selected_candidate: AttributionCandidate | null = null;

function update_page_heading(): void {
  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("subtitle");
  if (!title || !subtitle) {
    return;
  }

  if (has_attribution_inquiry && needs_classification) {
    title.textContent = t("classifyTitleBoth");
    subtitle.textContent = t("classifySubtitleBoth");
    return;
  }

  if (has_attribution_inquiry) {
    title.textContent = t("classifyTitleAttribution");
    subtitle.textContent = t("classifySubtitleAttribution");
    return;
  }

  title.textContent = t("classifyTitleDefault");
  subtitle.textContent = t("classifySubtitleDefault");
}

function get_download_id_from_url(): number {
  const params = new URLSearchParams(location.search);
  return Number(params.get("download_id") ?? 0);
}

function show_error(message: string): void {
  const element = document.getElementById("error-message");
  if (!element) {
    return;
  }
  element.textContent = message;
  element.classList.remove("hidden");
}

function hide_error(): void {
  document.getElementById("error-message")?.classList.add("hidden");
}

function get_selected_attribution_id(): string | undefined {
  const checked = document.querySelector<HTMLInputElement>(
    'input[name="attribution-choice"]:checked'
  );
  return checked?.value;
}

function apply_candidate_to_form(candidate: AttributionCandidate, record: DownloadRecord): void {
  selected_candidate = candidate;
  const merged: DownloadRecord = {
    ...record,
    attributed_site: candidate.site,
    attributed_page_url: candidate.page_url,
    attributed_page_title: candidate.page_title,
    attribution_method: candidate.method,
    attribution_confidence: candidate.confidence,
  };

  const defaults = suggest_rule_defaults(merged);
  const extension = extract_extension(record.original_filename);

  const set_text = (id: string, value: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value || "-";
    }
  };

  set_text("label-source-site", candidate.site || "-");
  set_text("label-download-site", record.download_site || "-");
  set_text("label-extension", extension || "-");
  set_text("label-filename", record.original_filename);

  const name_input = document.getElementById("rule-name") as HTMLInputElement;
  const folder_input = document.getElementById("rule-folder") as HTMLInputElement;
  const source_site = document.getElementById("match-source-site") as HTMLInputElement;
  const download_site = document.getElementById("match-download-site") as HTMLInputElement;

  name_input.value = defaults.name;
  folder_input.value = defaults.target_folder;
  source_site.checked = defaults.use_source_site;
  download_site.checked = defaults.use_download_site;
  source_site.disabled = !candidate.site;
}

function render_attribution_candidates(
  candidates: AttributionCandidate[],
  record: DownloadRecord
): void {
  const section = document.getElementById("attribution-section");
  const container = document.getElementById("attribution-options");
  if (!section || !container || !candidates.length) {
    return;
  }

  has_attribution_inquiry = true;
  section.classList.remove("hidden");
  document.getElementById("confirm-attribution")?.classList.remove("hidden");
  update_page_heading();

  container.innerHTML = candidates
    .map(
      (candidate, index) => `
      <label class="attribution-option">
        <input
          type="radio"
          name="attribution-choice"
          value="${candidate.id}"
          ${index === 0 ? "checked" : ""}
        />
        <span class="attribution-label">${escape_html(candidate.label)}</span>
        <span class="attribution-meta">${escape_html(candidate.page_url)}</span>
      </label>`
    )
    .join("");

  apply_candidate_to_form(candidates[0], record);

  container.querySelectorAll('input[name="attribution-choice"]').forEach((input) => {
    input.addEventListener("change", () => {
      const id = get_selected_attribution_id();
      const candidate = candidates.find((item) => item.id === id);
      if (candidate) {
        apply_candidate_to_form(candidate, record);
      }
    });
  });
}

function fill_form(record: DownloadRecord): void {
  const extension = extract_extension(record.original_filename);

  const set_text = (id: string, value: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value || "-";
    }
  };

  set_text("info-filename", record.filename);
  set_text("info-category", `${record.category} → ${record.target_folder}`);
  set_text("info-download-site", record.download_site);
  set_text("label-source-site", record.attributed_site || "-");
  set_text("label-download-site", record.download_site || "-");
  set_text("label-extension", extension || "-");
  set_text("label-filename", record.original_filename);

  const defaults = suggest_rule_defaults(record);
  const priority_input = document.getElementById("rule-priority") as HTMLInputElement;
  const extension_box = document.getElementById("match-extension") as HTMLInputElement;
  const filename_box = document.getElementById("match-filename") as HTMLInputElement;

  (document.getElementById("rule-name") as HTMLInputElement).value = defaults.name;
  (document.getElementById("rule-folder") as HTMLInputElement).value = defaults.target_folder;
  priority_input.value = String(defaults.priority || 50);
  extension_box.checked = defaults.use_extension;
  filename_box.checked = defaults.use_filename;
  extension_box.disabled = !extension;

  if (!has_attribution_inquiry) {
    (document.getElementById("match-source-site") as HTMLInputElement).checked =
      defaults.use_source_site;
    (document.getElementById("match-download-site") as HTMLInputElement).checked =
      defaults.use_download_site;
  }
}

function hide_attribution_section(): void {
  has_attribution_inquiry = false;
  document.getElementById("attribution-section")?.classList.add("hidden");
  document.getElementById("confirm-attribution")?.classList.add("hidden");
  update_page_heading();
}

function show_attribution_confirmed_note(): void {
  const section = document.getElementById("attribution-section");
  if (!section) {
    return;
  }
  section.innerHTML = `<p class="note">${escape_html(t("classifyAttributionConfirmed"))}</p>`;
  section.classList.remove("hidden");
}

function escape_html(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function load_page(): Promise<void> {
  apply_document_i18n();
  current_download_id = get_download_id_from_url();
  if (!current_download_id) {
    document.getElementById("loading")?.classList.add("hidden");
    document.getElementById("not-found")?.classList.remove("hidden");
    return;
  }

  const [record, candidates] = await Promise.all([
    chrome.runtime.sendMessage({
      type: "GET_UNCLASSIFIED_DOWNLOAD",
      download_id: current_download_id,
    }) as Promise<DownloadRecord | null>,
    chrome.runtime.sendMessage({
      type: "GET_ATTRIBUTION_CANDIDATES",
      download_id: current_download_id,
    }) as Promise<AttributionCandidate[]>,
  ]);

  document.getElementById("loading")?.classList.add("hidden");

  if (!record) {
    document.getElementById("not-found")?.classList.remove("hidden");
    return;
  }

  render_attribution_candidates(candidates, record);
  needs_classification = record.is_unclassified && !record.rule_prompt_dismissed;
  update_page_heading();
  fill_form(record);
  document.getElementById("download-info")?.classList.remove("hidden");
  document.getElementById("rule-form")?.classList.remove("hidden");
}

function build_payload() {
  return {
    download_id: current_download_id,
    name: (document.getElementById("rule-name") as HTMLInputElement).value,
    target_folder: (document.getElementById("rule-folder") as HTMLInputElement).value,
    priority: Number((document.getElementById("rule-priority") as HTMLInputElement).value) || 50,
    use_source_site: (document.getElementById("match-source-site") as HTMLInputElement).checked,
    use_download_site: (document.getElementById("match-download-site") as HTMLInputElement).checked,
    use_extension: (document.getElementById("match-extension") as HTMLInputElement).checked,
    use_filename: (document.getElementById("match-filename") as HTMLInputElement).checked,
    selected_attribution_id: get_selected_attribution_id(),
  };
}

async function save_rule(): Promise<void> {
  hide_error();

  const result = (await chrome.runtime.sendMessage({
    type: "SAVE_RULE_FROM_UNCLASSIFIED",
    payload: build_payload(),
  })) as { ok: boolean; error?: string };

  if (!result.ok) {
    show_error(result.error ?? t("errorSaveFailed"));
    return;
  }

  window.close();
}

async function confirm_attribution(): Promise<void> {
  hide_error();

  const result = (await chrome.runtime.sendMessage({
    type: "CONFIRM_ATTRIBUTION",
    download_id: current_download_id,
    selected_attribution_id: get_selected_attribution_id(),
  })) as { ok: boolean; error?: string; keep_open?: boolean };

  if (!result.ok) {
    show_error(result.error ?? t("errorConfirmFailed"));
    return;
  }

  if (result.keep_open) {
    const record = (await chrome.runtime.sendMessage({
      type: "GET_UNCLASSIFIED_DOWNLOAD",
      download_id: current_download_id,
    })) as DownloadRecord | null;
    if (record) {
      hide_attribution_section();
      show_attribution_confirmed_note();
      needs_classification = true;
      fill_form(record);
    }
    return;
  }

  window.close();
}

async function skip_rule(): Promise<void> {
  await chrome.runtime.sendMessage({
    type: "DISMISS_UNCLASSIFIED",
    download_id: current_download_id,
  });
  window.close();
}

document.getElementById("save-rule")?.addEventListener("click", () => {
  void save_rule();
});

document.getElementById("confirm-attribution")?.addEventListener("click", () => {
  void confirm_attribution();
});

document.getElementById("skip-rule")?.addEventListener("click", () => {
  void skip_rule();
});

void load_page();
