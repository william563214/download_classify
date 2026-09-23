import { host_matches_site, is_known_file_host, matches_any_pattern } from "./matcher";
import { t } from "./i18n";
import type {
  AppSettings,
  ClassificationRule,
  CurrentSiteStatus,
  SiteClassificationRule,
  SiteMatchTarget,
  SiteRuleMatch,
} from "./types";

function sanitize_path_segment(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "_").slice(0, 64);
}

function is_inquiry_site(hostname: string, inquiry_sites: string[]): boolean {
  return inquiry_sites.some((pattern) => host_matches_site(hostname, pattern));
}

function site_rule_applies_to_host(
  rule: SiteClassificationRule,
  hostname: string
): SiteMatchTarget | null {
  if (!rule.enabled || !rule.host.trim()) {
    return null;
  }
  if (!host_matches_site(hostname, rule.host)) {
    return null;
  }
  return rule.match_target;
}

function custom_rule_applies_to_host(
  rule: ClassificationRule,
  hostname: string
): ("source" | "download")[] {
  if (!rule.enabled) {
    return [];
  }

  const roles: ("source" | "download")[] = [];
  if (matches_any_pattern(hostname, rule.matchers.source_site)) {
    roles.push("source");
  }
  if (matches_any_pattern(hostname, rule.matchers.site)) {
    roles.push("download");
  }
  return roles;
}

function match_role_label(role: SiteRuleMatch["match_role"]): string {
  if (role === "source") {
    return t("matchRoleSource");
  }
  if (role === "download") {
    return t("matchRoleDownload");
  }
  return t("matchRoleEither");
}

export function format_match_role(role: SiteRuleMatch["match_role"]): string {
  return match_role_label(role);
}

export function resolve_site_status(
  hostname: string,
  rules: ClassificationRule[],
  site_rules: SiteClassificationRule[],
  settings: AppSettings
): Omit<CurrentSiteStatus, "page_title" | "page_url" | "unsupported_page"> {
  const classification_matches: SiteRuleMatch[] = [];

  for (const rule of site_rules) {
    const role = site_rule_applies_to_host(rule, hostname);
    if (!role) {
      continue;
    }
    classification_matches.push({
      kind: "site",
      name: rule.name.trim() || rule.host,
      target_folder: rule.target_folder,
      match_role: role,
    });
  }

  for (const rule of rules) {
    const roles = custom_rule_applies_to_host(rule, hostname);
    for (const role of roles) {
      classification_matches.push({
        kind: "custom",
        name: rule.name,
        target_folder: rule.target_folder,
        match_role: role,
      });
    }
  }

  const attribution = settings.attribution;
  const inquiry_site =
    attribution.inquiry_enabled && is_inquiry_site(hostname, attribution.inquiry_sites);
  const known_file_host = is_known_file_host(hostname, attribution.known_file_hosts);
  const site_rule =
    site_rules.find(
      (rule) => rule.enabled && rule.host.trim() && host_matches_site(hostname, rule.host)
    ) ?? null;

  return {
    hostname,
    classification_matches,
    fallback_folder: hostname ? `Sites/${sanitize_path_segment(hostname)}` : "Others",
    attribution_inquiry: inquiry_site,
    known_file_host,
    link_trace_enabled: Boolean(hostname),
    site_rule,
  };
}

export function is_trackable_page_url(url: string): boolean {
  if (!url) {
    return false;
  }
  return url.startsWith("http://") || url.startsWith("https://");
}
