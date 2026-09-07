import { host_matches_site } from "./matcher";
import type {
  ClassificationResult,
  DownloadContext,
  SiteClassificationRule,
} from "./types";

function site_rule_matches(rule: SiteClassificationRule, context: DownloadContext): boolean {
  const host_pattern = rule.host.trim();
  if (!host_pattern) {
    return false;
  }

  const source_match = Boolean(
    context.attributed_site && host_matches_site(context.attributed_site, host_pattern)
  );
  const download_match = Boolean(
    context.download_site && host_matches_site(context.download_site, host_pattern)
  );

  if (rule.match_target === "source") {
    return source_match;
  }
  if (rule.match_target === "download") {
    return download_match;
  }
  return source_match || download_match;
}

export function classify_by_site(
  context: DownloadContext,
  site_rules: SiteClassificationRule[]
): ClassificationResult | null {
  const enabled_rules = [...site_rules]
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of enabled_rules) {
    if (!site_rule_matches(rule, context)) {
      continue;
    }

    return {
      category: rule.name.trim() || rule.host,
      target_folder: rule.target_folder,
      matched_rule_id: `site:${rule.id}`,
    };
  }

  return null;
}
