import { host_matches_site } from "../shared/matcher";
import { get_site_rules, save_site_rules } from "../shared/storage";
import type { SaveSiteClassificationPayload, SiteClassificationRule } from "../shared/types";
import { init_download_cache } from "./download-handler";

function generate_id(): string {
  return `site_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function find_site_rule_index(
  rules: SiteClassificationRule[],
  host: string,
  id?: string
): number {
  if (id) {
    const by_id = rules.findIndex((rule) => rule.id === id);
    if (by_id >= 0) {
      return by_id;
    }
  }

  return rules.findIndex((rule) => host_matches_site(host, rule.host));
}

export async function upsert_site_classification(
  payload: SaveSiteClassificationPayload
): Promise<{ ok: boolean; error?: string; rule?: SiteClassificationRule }> {
  const host = payload.host.trim();
  const target_folder = payload.target_folder.trim();
  const name = payload.name.trim();

  if (!host) {
    return { ok: false, error: "請填寫網域" };
  }
  if (!target_folder) {
    return { ok: false, error: "請填寫目標資料夾" };
  }

  const rules = await get_site_rules();
  const index = find_site_rule_index(rules, host, payload.id);
  const rule: SiteClassificationRule = {
    id: index >= 0 ? rules[index].id : generate_id(),
    name: name || host,
    host,
    target_folder,
    match_target: payload.match_target,
    priority: index >= 0 ? rules[index].priority : 30,
    enabled: true,
  };

  if (index >= 0) {
    rules[index] = rule;
  } else {
    rules.push(rule);
  }

  await save_site_rules(rules);
  await init_download_cache();

  return { ok: true, rule };
}
