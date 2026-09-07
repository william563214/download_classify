export type AttributionConfidence = "high" | "medium" | "low";

export type AttributionMethod =
  | "link_click"
  | "opener_tab"
  | "navigation_chain"
  | "referrer"
  | "download_url_fallback";

export interface RuleMatchers {
  site?: string[];
  source_site?: string[];
  source_page?: string[];
  filename?: string[];
  extension?: string[];
}

export interface ClassificationRule {
  id: string;
  name: string;
  target_folder: string;
  priority: number;
  enabled: boolean;
  matchers: RuleMatchers;
}

export interface ExtensionRule {
  extension: string;
  target_folder: string;
  name: string;
}

export type SiteMatchTarget = "source" | "download" | "either";

export interface SiteClassificationRule {
  id: string;
  name: string;
  host: string;
  target_folder: string;
  match_target: SiteMatchTarget;
  priority: number;
  enabled: boolean;
}

export interface RenameOptions {
  add_source_domain: boolean;
  domain_position: "prefix" | "suffix";
  separator: string;
}

export interface AttributionSettings {
  pending_ttl_minutes: number;
  known_file_hosts: string[];
  inquiry_sites: string[];
  inquiry_enabled: boolean;
}

export interface UnclassifiedPromptSettings {
  enabled: boolean;
}

export interface AppSettings {
  rename: RenameOptions;
  attribution: AttributionSettings;
  unclassified_prompt: UnclassifiedPromptSettings;
  history_imported: boolean;
}

export interface PendingAttribution {
  from_site: string;
  from_page_url: string;
  from_page_title: string;
  to_url: string;
  to_hostname: string;
  clicked_at: number;
  expires_at: number;
}

export interface TabSourceInfo {
  source_site: string;
  source_page_url: string;
  source_page_title: string;
  entry_site: string;
  entry_page_url: string;
  updated_at: number;
}

export interface DownloadContext {
  download_id: number;
  download_url: string;
  download_site: string;
  attributed_site: string;
  attributed_page_url: string;
  attributed_page_title: string;
  attribution_method: AttributionMethod;
  attribution_confidence: AttributionConfidence;
}

export interface ClassificationResult {
  category: string;
  target_folder: string;
  matched_rule_id: string | null;
}

export interface DownloadRecord extends DownloadContext {
  filename: string;
  original_filename: string;
  category: string;
  target_folder: string;
  matched_rule_id: string | null;
  is_unclassified: boolean;
  rule_prompt_dismissed: boolean;
  attribution_inquiry_dismissed: boolean;
  mime: string;
  file_size: number;
  state: string;
  started_at: string;
  completed_at: string | null;
  imported: boolean;
}

export interface PendingClassification {
  context: DownloadContext;
  classification: ClassificationResult;
  original_basename: string;
}

export type ContentMessage =
  | {
      type: "LINK_CLICKED";
      from_site: string;
      from_page_url: string;
      from_page_title: string;
      to_url: string;
    }
  | {
      type: "PAGE_REFERRER";
      page_url: string;
      page_title: string;
      referrer: string;
      tab_id?: number;
    };

export interface ImportStats {
  imported: number;
  skipped: number;
  total: number;
}

export interface SaveRuleFromUnclassifiedPayload {
  download_id: number;
  name: string;
  target_folder: string;
  priority: number;
  use_source_site: boolean;
  use_download_site: boolean;
  use_extension: boolean;
  use_filename: boolean;
  selected_attribution_id?: string;
}

export interface CurrentSiteStatus {
  hostname: string;
  page_title: string;
  page_url: string;
  unsupported_page: boolean;
  classification_matches: SiteRuleMatch[];
  fallback_folder: string;
  attribution_inquiry: boolean;
  known_file_host: boolean;
  link_trace_enabled: boolean;
  site_rule: SiteClassificationRule | null;
}

export interface SiteRuleMatch {
  kind: "site" | "custom";
  name: string;
  target_folder: string;
  match_role: SiteMatchTarget | "source" | "download";
}

export interface SaveSiteClassificationPayload {
  id?: string;
  name: string;
  host: string;
  target_folder: string;
  match_target: SiteMatchTarget;
}

export type RuntimeMessage =
  | { type: "IMPORT_HISTORY"; force?: boolean }
  | { type: "REFRESH_CACHE" }
  | { type: "GET_UNCLASSIFIED_DOWNLOAD"; download_id: number }
  | { type: "GET_ATTRIBUTION_CANDIDATES"; download_id: number }
  | { type: "GET_UNCLASSIFIED_DOWNLOADS" }
  | { type: "SAVE_RULE_FROM_UNCLASSIFIED"; payload: SaveRuleFromUnclassifiedPayload }
  | { type: "CONFIRM_ATTRIBUTION"; download_id: number; selected_attribution_id?: string }
  | { type: "DISMISS_UNCLASSIFIED"; download_id: number }
  | { type: "OPEN_CLASSIFY_PROMPT"; download_id: number }
  | { type: "GET_CURRENT_SITE_STATUS" }
  | { type: "SAVE_SITE_CLASSIFICATION"; payload: SaveSiteClassificationPayload };
