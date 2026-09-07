import { extract_hostname, urls_related } from "../shared/matcher";
import type { AttributionCandidate } from "../shared/attribution-candidate";
import type { PendingAttribution, TabSourceInfo } from "../shared/types";
import { download_matches_page_context } from "./attribution";

function candidate_id(site: string, page_url: string): string {
  return `${site}::${page_url}`;
}

function add_candidate(
  candidates: AttributionCandidate[],
  seen: Set<string>,
  entry: Omit<AttributionCandidate, "id">
): void {
  const id = candidate_id(entry.site, entry.page_url);
  if (seen.has(id) || !entry.site) {
    return;
  }
  seen.add(id);
  candidates.push({ ...entry, id });
}

export function build_attribution_candidates(
  download_url: string,
  download_site: string,
  referrer: string,
  pending: PendingAttribution[],
  tab_sources: Record<number, TabSourceInfo>,
  pending_click_max_age_ms: number
): AttributionCandidate[] {
  const candidates: AttributionCandidate[] = [];
  const seen = new Set<string>();
  const now = Date.now();

  if (referrer) {
    const referrer_site = extract_hostname(referrer);
    add_candidate(candidates, seen, {
      site: referrer_site,
      page_url: referrer,
      page_title: "",
      method: "referrer",
      confidence: "medium",
      label: `下載頁面（${referrer_site}）`,
    });
  }

  add_candidate(candidates, seen, {
    site: download_site,
    page_url: download_url,
    page_title: "",
    method: "download_url_fallback",
    confidence: "low",
    label: `僅以下載站（${download_site}）`,
  });

  for (const item of pending) {
    const host_match =
      urls_related(download_url, item.to_url) ||
      download_site === item.to_hostname ||
      download_site.endsWith(`.${item.to_hostname}`);

    if (!host_match || now - item.clicked_at > pending_click_max_age_ms) {
      continue;
    }

    add_candidate(candidates, seen, {
      site: item.from_site,
      page_url: item.from_page_url,
      page_title: item.from_page_title,
      method: "link_click",
      confidence: "high",
      label: `來自 ${item.from_site} 的連結`,
    });
  }

  for (const source of Object.values(tab_sources)) {
    if (!source.source_site || !source.entry_site) {
      continue;
    }
    if (source.source_site === source.entry_site) {
      continue;
    }

    const entry_matches = download_matches_page_context(
      download_url,
      download_site,
      source.entry_page_url,
      source.entry_site
    );
    if (!entry_matches) {
      continue;
    }

    add_candidate(candidates, seen, {
      site: source.source_site,
      page_url: source.source_page_url,
      page_title: source.source_page_title,
      method: "opener_tab",
      confidence: "high",
      label: `來自 ${source.source_site}（分頁來源）`,
    });
  }

  return candidates;
}

export function is_inquiry_site(download_site: string, inquiry_sites: string[]): boolean {
  const lower = download_site.toLowerCase();
  return inquiry_sites.some((host) => {
    const pattern = host.toLowerCase();
    return lower === pattern || lower.endsWith(`.${pattern}`);
  });
}
