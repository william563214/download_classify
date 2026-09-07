import { extract_hostname } from "../shared/matcher";
import {
  get_rules,
  get_settings,
  get_site_rules,
} from "../shared/storage";
import {
  is_trackable_page_url,
  resolve_site_status,
} from "../shared/site-status";
import type { CurrentSiteStatus } from "../shared/types";

export async function resolve_current_site_status_for_active_tab(): Promise<CurrentSiteStatus> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const page_url = tab?.url ?? "";
  const page_title = tab?.title ?? "";
  const hostname = extract_hostname(page_url);

  if (!is_trackable_page_url(page_url) || !hostname) {
    return {
      hostname: hostname || "—",
      page_title,
      page_url,
      unsupported_page: true,
      classification_matches: [],
      fallback_folder: "Others",
      attribution_inquiry: false,
      known_file_host: false,
      link_trace_enabled: false,
      site_rule: null,
    };
  }

  const [rules, site_rules, settings] = await Promise.all([
    get_rules(),
    get_site_rules(),
    get_settings(),
  ]);

  const resolved = resolve_site_status(hostname, rules, site_rules, settings);

  return {
    ...resolved,
    page_title,
    page_url,
    unsupported_page: false,
  };
}
