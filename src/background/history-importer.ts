import { extract_basename, extract_hostname } from "../shared/matcher";
import {
  get_all_download_ids,
  get_extension_rules,
  get_rules,
  get_settings,
  get_site_rules,
  save_settings,
  upsert_download_record,
} from "../shared/storage";
import type { DownloadRecord, ImportStats } from "../shared/types";
import { build_context_from_urls, classify_download } from "./classifier";
import { is_unclassified_result } from "../shared/unclassified";

export async function import_download_history(force = false): Promise<ImportStats> {
  const settings = await get_settings();
  if (settings.history_imported && !force) {
    const existing = await get_all_download_ids();
    return { imported: 0, skipped: existing.size, total: existing.size };
  }

  const [items, existing_ids, rules, site_rules, extension_rules] = await Promise.all([
    chrome.downloads.search({}),
    get_all_download_ids(),
    get_rules(),
    get_site_rules(),
    get_extension_rules(),
  ]);

  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    if (existing_ids.has(item.id)) {
      skipped += 1;
      continue;
    }

    const download_url = item.finalUrl || item.url;
    const referrer_site = extract_hostname(item.referrer ?? "");
    const download_site = extract_hostname(download_url);
    const attributed_site = referrer_site || download_site;

    const context = build_context_from_urls(
      item.id,
      download_url,
      attributed_site,
      item.referrer ?? download_url,
      "",
      "download_url_fallback",
      "low"
    );

    const original_basename = extract_basename(item.filename);
    const classification = classify_download({
      context,
      filename: original_basename,
      rules,
      site_rules,
      extension_rules,
    });

    const record: DownloadRecord = {
      ...context,
      filename: extract_basename(item.filename),
      original_filename: original_basename,
      category: classification.category,
      target_folder: classification.target_folder,
      matched_rule_id: classification.matched_rule_id,
      is_unclassified: is_unclassified_result(classification, rules),
      rule_prompt_dismissed: true,
      attribution_inquiry_dismissed: true,
      mime: item.mime ?? "",
      file_size: item.fileSize ?? 0,
      state: item.state ?? "complete",
      started_at: new Date(item.startTime).toISOString(),
      completed_at:
        item.state === "complete" ? new Date(item.endTime || item.startTime).toISOString() : null,
      imported: true,
    };

    await upsert_download_record(record);
    imported += 1;
  }

  if (!force) {
    await save_settings({ ...settings, history_imported: true });
  }

  return {
    imported,
    skipped,
    total: items.length,
  };
}
