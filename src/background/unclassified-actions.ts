import { build_rule_from_form } from "../shared/rule-builder";
import {
  get_attribution_candidates,
  get_download_record,
  get_rules,
  mark_attribution_inquiry_dismissed,
  mark_download_classified,
  save_rules,
  update_download_attribution,
} from "../shared/storage";
import type { SaveRuleFromUnclassifiedPayload } from "../shared/types";
import { init_download_cache } from "./download-handler";
import { close_classify_window, dismiss_unclassified_prompt } from "./unclassified-prompt";

async function resolve_selected_candidate(download_id: number, selected_id?: string) {
  const candidates = await get_attribution_candidates(download_id);
  if (!candidates.length) {
    return null;
  }
  if (selected_id) {
    return candidates.find((item) => item.id === selected_id) ?? candidates[0];
  }
  return candidates[0];
}

export async function save_selected_attribution(
  download_id: number,
  selected_attribution_id?: string
): Promise<{ ok: boolean; error?: string }> {
  const candidate = await resolve_selected_candidate(download_id, selected_attribution_id);
  if (!candidate) {
    return { ok: false, error: "沒有可選的歸因項目" };
  }

  await update_download_attribution(
    download_id,
    candidate.site,
    candidate.page_url,
    candidate.page_title,
    candidate.method,
    candidate.confidence
  );

  return { ok: true };
}

export async function save_rule_from_unclassified(
  payload: SaveRuleFromUnclassifiedPayload
): Promise<{ ok: boolean; error?: string }> {
  const record = await get_download_record(payload.download_id);
  if (!record) {
    return { ok: false, error: "找不到下載紀錄" };
  }

  const candidate = await resolve_selected_candidate(
    payload.download_id,
    payload.selected_attribution_id
  );

  const record_for_rule = candidate
    ? {
        ...record,
        attributed_site: candidate.site,
        attributed_page_url: candidate.page_url,
        attributed_page_title: candidate.page_title,
        attribution_method: candidate.method,
        attribution_confidence: candidate.confidence,
      }
    : record;

  if (candidate) {
    await update_download_attribution(
      payload.download_id,
      candidate.site,
      candidate.page_url,
      candidate.page_title,
      candidate.method,
      candidate.confidence
    );
    await mark_attribution_inquiry_dismissed(payload.download_id);
  }

  const rule = build_rule_from_form({
    name: payload.name,
    target_folder: payload.target_folder,
    priority: payload.priority,
    use_source_site: payload.use_source_site,
    use_download_site: payload.use_download_site,
    use_extension: payload.use_extension,
    use_filename: payload.use_filename,
    record: record_for_rule,
  });

  const matcher_keys = Object.values(rule.matchers).filter((value) => value?.length);
  if (!matcher_keys.length) {
    return { ok: false, error: "請至少選擇一項匹配條件" };
  }

  const rules = await get_rules();
  rules.push(rule);
  await save_rules(rules);
  await mark_download_classified(
    payload.download_id,
    rule.name,
    rule.target_folder,
    rule.id
  );
  await init_download_cache();
  await dismiss_unclassified_prompt(payload.download_id);

  return { ok: true };
}

export async function confirm_attribution_only(
  download_id: number,
  selected_attribution_id?: string
): Promise<{ ok: boolean; error?: string; keep_open?: boolean }> {
  const record = await get_download_record(download_id);
  if (!record) {
    return { ok: false, error: "找不到下載紀錄" };
  }

  const result = await save_selected_attribution(download_id, selected_attribution_id);
  if (!result.ok) {
    return result;
  }

  await mark_attribution_inquiry_dismissed(download_id);

  if (record.is_unclassified && !record.rule_prompt_dismissed) {
    return { ok: true, keep_open: true };
  }

  await close_classify_window(download_id);
  return { ok: true };
}
