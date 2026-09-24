import {
  get_extension_rules,
  get_rules,
  get_settings,
  get_site_rules,
  save_extension_rules,
  save_rules,
  save_settings,
  save_site_rules,
} from "../shared/storage";
import { apply_document_i18n, t } from "../shared/i18n";
import type {
  AppSettings,
  ClassificationRule,
  ExtensionRule,
  ImportStats,
  SiteClassificationRule,
  SiteMatchTarget,
} from "../shared/types";

let current_rules: ClassificationRule[] = [];
let current_site_rules: SiteClassificationRule[] = [];
let current_extension_rules: ExtensionRule[] = [];

function generate_id(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parse_lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function join_lines(values: string[] | undefined): string {
  return (values ?? []).join("\n");
}

function render_site_rules(): void {
  const container = document.getElementById("site-rules-container");
  if (!container) {
    return;
  }

  container.innerHTML = current_site_rules
    .map(
      (rule, index) => `
      <div class="rule-card site-rule-card" data-site-index="${index}">
        <label>${escape_html(t("optionsLabelDisplayName"))} <input type="text" class="site-name" value="${escape_attr(rule.name)}" /></label>
        <label>${escape_html(t("optionsLabelHost"))} <input type="text" class="site-host" placeholder="${escape_attr(t("optionsHostPlaceholder"))}" value="${escape_attr(rule.host)}" /></label>
        <label>${escape_html(t("optionsLabelMatchTarget"))}
          <select class="site-match-target">
            <option value="source" ${rule.match_target === "source" ? "selected" : ""}>${escape_html(t("matchRoleSource"))}</option>
            <option value="download" ${rule.match_target === "download" ? "selected" : ""}>${escape_html(t("matchRoleDownload"))}</option>
            <option value="either" ${rule.match_target === "either" ? "selected" : ""}>${escape_html(t("matchRoleEither"))}</option>
          </select>
        </label>
        <label>${escape_html(t("optionsLabelTargetFolder"))} <input type="text" class="site-folder" value="${escape_attr(rule.target_folder)}" /></label>
        <label>${escape_html(t("optionsLabelPriority"))} <input type="number" class="site-priority" value="${rule.priority}" /></label>
        <label><input type="checkbox" class="site-enabled" ${rule.enabled ? "checked" : ""} /> ${escape_html(t("optionsLabelEnabled"))}</label>
        <div class="rule-actions">
          <button type="button" class="delete-site-rule">${escape_html(t("optionsDelete"))}</button>
        </div>
      </div>`
    )
    .join("");

  container.querySelectorAll(".delete-site-rule").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".site-rule-card");
      const index = Number(card?.getAttribute("data-site-index"));
      current_site_rules.splice(index, 1);
      render_site_rules();
    });
  });
}

function render_rules(): void {
  const container = document.getElementById("rules-container");
  if (!container) {
    return;
  }

  container.innerHTML = current_rules
    .map(
      (rule, index) => `
      <div class="rule-card" data-index="${index}">
        <label>${escape_html(t("optionsLabelName"))} <input type="text" class="rule-name" value="${escape_attr(rule.name)}" /></label>
        <label>${escape_html(t("optionsLabelTargetFolder"))} <input type="text" class="rule-folder" value="${escape_attr(rule.target_folder)}" /></label>
        <label>${escape_html(t("optionsLabelPriority"))} <input type="number" class="rule-priority" value="${rule.priority}" /></label>
        <label><input type="checkbox" class="rule-enabled" ${rule.enabled ? "checked" : ""} /> ${escape_html(t("optionsLabelEnabled"))}</label>
        <label>${escape_html(t("optionsLabelSourceSites"))}<textarea class="rule-source-site" rows="2">${escape_html(join_lines(rule.matchers.source_site))}</textarea></label>
        <label>${escape_html(t("optionsLabelSourcePages"))}<textarea class="rule-source-page" rows="2">${escape_html(join_lines(rule.matchers.source_page))}</textarea></label>
        <label>${escape_html(t("optionsLabelDownloadSites"))}<textarea class="rule-site" rows="2">${escape_html(join_lines(rule.matchers.site))}</textarea></label>
        <label>${escape_html(t("optionsLabelFilenames"))}<textarea class="rule-filename" rows="2">${escape_html(join_lines(rule.matchers.filename))}</textarea></label>
        <label>${escape_html(t("optionsLabelExtensions"))}<input type="text" class="rule-extension" value="${escape_attr((rule.matchers.extension ?? []).join(","))}" /></label>
        <div class="rule-actions">
          <button type="button" class="delete-rule">${escape_html(t("optionsDelete"))}</button>
        </div>
      </div>`
    )
    .join("");

  container.querySelectorAll(".delete-rule").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".rule-card");
      const index = Number(card?.getAttribute("data-index"));
      current_rules.splice(index, 1);
      render_rules();
    });
  });
}

function render_extension_rules(): void {
  const container = document.getElementById("extension-rules-container");
  if (!container) {
    return;
  }

  container.innerHTML = current_extension_rules
    .map(
      (rule, index) => `
      <div class="rule-card" data-ext-index="${index}">
        <label>${escape_html(t("optionsLabelType"))} <input type="text" class="ext-name" value="${escape_attr(rule.name)}" /></label>
        <label>${escape_html(t("optionsLabelExtension"))} <input type="text" class="ext-extension" value="${escape_attr(rule.extension)}" /></label>
        <label>${escape_html(t("optionsLabelTargetFolder"))} <input type="text" class="ext-folder" value="${escape_attr(rule.target_folder)}" /></label>
        <div class="rule-actions">
          <button type="button" class="delete-ext-rule">${escape_html(t("optionsDelete"))}</button>
        </div>
      </div>`
    )
    .join("");

  container.querySelectorAll(".delete-ext-rule").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".rule-card");
      const index = Number(card?.getAttribute("data-ext-index"));
      current_extension_rules.splice(index, 1);
      render_extension_rules();
    });
  });
}

function collect_site_rules_from_dom(): SiteClassificationRule[] {
  const cards = document.querySelectorAll("#site-rules-container .site-rule-card");
  return Array.from(cards).map((card, index) => {
    const existing = current_site_rules[index];
    return {
      id: existing?.id ?? generate_id(),
      name: card.querySelector<HTMLInputElement>(".site-name")?.value ?? "",
      host: card.querySelector<HTMLInputElement>(".site-host")?.value.trim() ?? "",
      target_folder: card.querySelector<HTMLInputElement>(".site-folder")?.value ?? "Others",
      match_target:
        (card.querySelector<HTMLSelectElement>(".site-match-target")?.value as SiteMatchTarget) ??
        "either",
      priority: Number(card.querySelector<HTMLInputElement>(".site-priority")?.value ?? 30),
      enabled: card.querySelector<HTMLInputElement>(".site-enabled")?.checked ?? true,
    };
  });
}

function collect_rules_from_dom(): ClassificationRule[] {
  const cards = document.querySelectorAll("#rules-container .rule-card");
  return Array.from(cards).map((card, index) => {
    const existing = current_rules[index];
    const extensions = (card.querySelector<HTMLInputElement>(".rule-extension")?.value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      id: existing?.id ?? generate_id(),
      name: card.querySelector<HTMLInputElement>(".rule-name")?.value ?? "",
      target_folder: card.querySelector<HTMLInputElement>(".rule-folder")?.value ?? "Others",
      priority: Number(card.querySelector<HTMLInputElement>(".rule-priority")?.value ?? 100),
      enabled: card.querySelector<HTMLInputElement>(".rule-enabled")?.checked ?? true,
      matchers: {
        source_site: parse_lines(card.querySelector<HTMLTextAreaElement>(".rule-source-site")?.value ?? ""),
        source_page: parse_lines(card.querySelector<HTMLTextAreaElement>(".rule-source-page")?.value ?? ""),
        site: parse_lines(card.querySelector<HTMLTextAreaElement>(".rule-site")?.value ?? ""),
        filename: parse_lines(card.querySelector<HTMLTextAreaElement>(".rule-filename")?.value ?? ""),
        extension: extensions,
      },
    };
  });
}

function collect_extension_rules_from_dom(): ExtensionRule[] {
  const cards = document.querySelectorAll("#extension-rules-container .rule-card");
  return Array.from(cards).map((card) => ({
    name: card.querySelector<HTMLInputElement>(".ext-name")?.value ?? "",
    extension: (card.querySelector<HTMLInputElement>(".ext-extension")?.value ?? "").toLowerCase(),
    target_folder: card.querySelector<HTMLInputElement>(".ext-folder")?.value ?? "Others",
  }));
}

function escape_html(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escape_attr(value: string): string {
  return escape_html(value).replace(/"/g, "&quot;");
}

async function load_settings_ui(): Promise<void> {
  apply_document_i18n();
  const settings = await get_settings();
  current_rules = await get_rules();
  current_site_rules = await get_site_rules();
  current_extension_rules = await get_extension_rules();

  const rename_enabled = document.getElementById("rename-enabled") as HTMLInputElement;
  const domain_position = document.getElementById("domain-position") as HTMLSelectElement;
  const separator = document.getElementById("separator") as HTMLInputElement;
  const pending_ttl = document.getElementById("pending-ttl") as HTMLInputElement;
  const known_hosts = document.getElementById("known-hosts") as HTMLTextAreaElement;
  const unclassified_prompt_enabled = document.getElementById(
    "unclassified-prompt-enabled"
  ) as HTMLInputElement;
  const inquiry_enabled = document.getElementById("inquiry-enabled") as HTMLInputElement;
  const inquiry_sites = document.getElementById("inquiry-sites") as HTMLTextAreaElement;

  rename_enabled.checked = settings.rename.add_source_domain;
  domain_position.value = settings.rename.domain_position;
  separator.value = settings.rename.separator;
  pending_ttl.value = String(settings.attribution.pending_ttl_minutes);
  known_hosts.value = settings.attribution.known_file_hosts.join("\n");
  unclassified_prompt_enabled.checked = settings.unclassified_prompt.enabled;
  inquiry_enabled.checked = settings.attribution.inquiry_enabled;
  inquiry_sites.value = settings.attribution.inquiry_sites.join("\n");

  render_site_rules();
  render_rules();
  render_extension_rules();
}

async function save_all_settings(): Promise<void> {
  const settings: AppSettings = {
    ...(await get_settings()),
    rename: {
      add_source_domain: (document.getElementById("rename-enabled") as HTMLInputElement).checked,
      domain_position: (document.getElementById("domain-position") as HTMLSelectElement).value as AppSettings["rename"]["domain_position"],
      separator: (document.getElementById("separator") as HTMLInputElement).value || "_",
    },
    attribution: {
      pending_ttl_minutes: Number((document.getElementById("pending-ttl") as HTMLInputElement).value) || 10,
      known_file_hosts: parse_lines((document.getElementById("known-hosts") as HTMLTextAreaElement).value),
      inquiry_enabled: (document.getElementById("inquiry-enabled") as HTMLInputElement).checked,
      inquiry_sites: parse_lines((document.getElementById("inquiry-sites") as HTMLTextAreaElement).value),
    },
    unclassified_prompt: {
      enabled: (document.getElementById("unclassified-prompt-enabled") as HTMLInputElement).checked,
    },
  };

  current_rules = collect_rules_from_dom();
  current_site_rules = collect_site_rules_from_dom();
  current_extension_rules = collect_extension_rules_from_dom();

  await save_settings(settings);
  await save_rules(current_rules);
  await save_site_rules(current_site_rules);
  await save_extension_rules(current_extension_rules);

  chrome.runtime.sendMessage({ type: "REFRESH_CACHE" });

  const status = document.getElementById("save-status");
  if (status) {
    status.textContent = t("optionsSaved");
    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  }
}

async function run_import(force: boolean): Promise<void> {
  const status = document.getElementById("import-status");
  const result = (await chrome.runtime.sendMessage({
    type: "IMPORT_HISTORY",
    force,
  })) as ImportStats;

  if (status) {
    status.textContent = t("optionsImportStats", [
      String(result.imported),
      String(result.skipped),
      String(result.total),
    ]);
  }
}

function export_rules_json(): void {
  const payload = {
    rules: collect_rules_from_dom(),
    site_rules: collect_site_rules_from_dom(),
    extension_rules: collect_extension_rules_from_dom(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "download-classify-rules.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function import_rules_json(file: File): Promise<void> {
  const text = await file.text();
  const payload = JSON.parse(text) as {
    rules?: ClassificationRule[];
    site_rules?: SiteClassificationRule[];
    extension_rules?: ExtensionRule[];
  };

  if (payload.rules) {
    current_rules = payload.rules;
  }
  if (payload.site_rules) {
    current_site_rules = payload.site_rules;
  }
  if (payload.extension_rules) {
    current_extension_rules = payload.extension_rules;
  }

  render_site_rules();
  render_rules();
  render_extension_rules();
}

document.getElementById("add-site-rule")?.addEventListener("click", () => {
  current_site_rules.push({
    id: generate_id(),
    name: t("optionsDefaultSiteName"),
    host: "",
    target_folder: "Sites",
    match_target: "either",
    priority: 30,
    enabled: true,
  });
  render_site_rules();
});

document.getElementById("add-rule")?.addEventListener("click", () => {
  current_rules.push({
    id: generate_id(),
    name: t("optionsDefaultRuleName"),
    target_folder: "Others",
    priority: 100,
    enabled: true,
    matchers: {},
  });
  render_rules();
});

document.getElementById("add-extension-rule")?.addEventListener("click", () => {
  current_extension_rules.push({
    name: t("optionsDefaultExtName"),
    extension: "txt",
    target_folder: "Others",
  });
  render_extension_rules();
});

document.getElementById("save-settings")?.addEventListener("click", () => {
  void save_all_settings();
});

document.getElementById("import-history")?.addEventListener("click", () => {
  void run_import(false);
});

document.getElementById("force-import-history")?.addEventListener("click", () => {
  void run_import(true);
});

document.getElementById("export-rules")?.addEventListener("click", () => {
  export_rules_json();
});

document.getElementById("import-rules-file")?.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    void import_rules_json(file);
  }
});

void load_settings_ui();
