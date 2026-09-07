import { default_extension_rules, default_rename } from "../shared/constants";
import { build_classified_path } from "../shared/filename";
import { extract_basename } from "../shared/matcher";
import {
  get_extension_rules,
  get_rules,
  get_settings,
  get_site_rules,
  get_download_record,
  upsert_download_record,
} from "../shared/storage";
import type {
  DownloadContext,
  DownloadRecord,
  PendingClassification,
} from "../shared/types";
import { resolve_download_context, store_attribution_candidates_for_download, refresh_settings_cache } from "./attribution";
import { classify_download } from "./classifier";
import { maybe_prompt_after_download } from "./unclassified-prompt";
import { is_unclassified_result } from "../shared/unclassified";
import type { ClassificationRule, ExtensionRule, RenameOptions, SiteClassificationRule } from "../shared/types";

const pending_classifications = new Map<number, PendingClassification>();

let memory_rules: ClassificationRule[] = [];
let memory_site_rules: SiteClassificationRule[] = [];
let memory_extension_rules: ExtensionRule[] = [...default_extension_rules];
let memory_rename: RenameOptions = { ...default_rename };

export function get_pending_classification(download_id: number): PendingClassification | undefined {
  return pending_classifications.get(download_id);
}

export async function init_download_cache(): Promise<void> {
  const [rules, site_rules, extension_rules, settings] = await Promise.all([
    get_rules(),
    get_site_rules(),
    get_extension_rules(),
    get_settings(),
  ]);
  memory_rules = rules;
  memory_site_rules = site_rules;
  memory_extension_rules = extension_rules;
  memory_rename = settings.rename;
  refresh_settings_cache(settings);
}

export async function refresh_download_cache(): Promise<void> {
  await init_download_cache();
}

function build_record_from_item(
  item: chrome.downloads.DownloadItem,
  pending: PendingClassification | undefined,
  existing: DownloadRecord | null,
  context: DownloadContext
): DownloadRecord {
  const incoming_state = item.state ?? "in_progress";
  const state = existing?.state === "complete" ? "complete" : incoming_state;
  const classification = pending?.classification;
  const original_basename =
    pending?.original_basename ?? existing?.original_filename ?? extract_basename(item.filename);

  return {
    ...context,
    filename: extract_basename(item.filename),
    original_filename: original_basename,
    category: classification?.category ?? existing?.category ?? "其他",
    target_folder: classification?.target_folder ?? existing?.target_folder ?? "Others",
    matched_rule_id: classification?.matched_rule_id ?? existing?.matched_rule_id ?? null,
    is_unclassified: classification
      ? is_unclassified_result(classification, memory_rules)
      : (existing?.is_unclassified ?? true),
    rule_prompt_dismissed: existing?.rule_prompt_dismissed ?? false,
    attribution_inquiry_dismissed: existing?.attribution_inquiry_dismissed ?? false,
    mime: item.mime ?? existing?.mime ?? "",
    file_size: item.fileSize ?? existing?.file_size ?? 0,
    state,
    started_at: existing?.started_at ?? new Date(item.startTime).toISOString(),
    completed_at:
      state === "complete"
        ? existing?.completed_at ?? new Date().toISOString()
        : null,
    imported: existing?.imported ?? false,
  };
}

async function finalize_completed_download(
  item: chrome.downloads.DownloadItem,
  record: DownloadRecord
): Promise<void> {
  await store_attribution_candidates_for_download(item);
  await maybe_prompt_after_download(record);
}

export function register_download_handlers(): void {
  chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    void apply_download_filename(item, suggest);
    return true;
  });

  chrome.downloads.onCreated.addListener((item) => {
    void handle_download_created(item);
  });

  chrome.downloads.onChanged.addListener((delta) => {
    if (delta.state || delta.filename || delta.fileSize) {
      void handle_download_changed(delta);
    }
  });
}

async function apply_download_filename(
  item: chrome.downloads.DownloadItem,
  suggest: (result: chrome.downloads.DownloadFilenameSuggestion) => void
): Promise<void> {
  const original_basename = extract_basename(item.filename);
  const context = await resolve_download_context(item);
  const classification = classify_download({
    context,
    filename: original_basename,
    rules: memory_rules,
    site_rules: memory_site_rules,
    extension_rules: memory_extension_rules,
  });

  const classified_path = build_classified_path(
    classification.target_folder,
    original_basename,
    context.attributed_site,
    memory_rename
  );

  pending_classifications.set(item.id, {
    context,
    classification,
    original_basename,
  });

  suggest({
    filename: classified_path,
    conflictAction: "uniquify",
  });
}

async function handle_download_created(item: chrome.downloads.DownloadItem): Promise<void> {
  const existing = await get_download_record(item.id);
  if (existing?.state === "complete") {
    return;
  }

  const pending = pending_classifications.get(item.id);
  const context = pending?.context ?? (await resolve_download_context(item));

  if (!pending) {
    const original_basename = extract_basename(item.filename);
    const classification = classify_download({
      context,
      filename: original_basename,
      rules: memory_rules,
      site_rules: memory_site_rules,
      extension_rules: memory_extension_rules,
    });
    pending_classifications.set(item.id, {
      context,
      classification,
      original_basename,
    });
  }

  const record = build_record_from_item(
    item,
    pending_classifications.get(item.id),
    existing,
    context
  );

  await upsert_download_record(record);

  if (record.state === "complete") {
    await finalize_completed_download(item, record);
    pending_classifications.delete(item.id);
  }
}

async function handle_download_changed(delta: chrome.downloads.DownloadDelta): Promise<void> {
  const download_id = delta.id;
  const items = await chrome.downloads.search({ id: download_id });
  const current = items[0];
  if (!current) {
    return;
  }

  const existing = await get_download_record(download_id);
  const pending = pending_classifications.get(download_id);
  const context = pending?.context ?? (await resolve_download_context(current));

  const record = build_record_from_item(current, pending, existing, context);

  await upsert_download_record(record);

  if (current.state === "complete") {
    await finalize_completed_download(current, record);
  }

  if (current.state === "complete" || current.state === "interrupted") {
    pending_classifications.delete(download_id);
  }
}
