import {
  extract_hostname,
  urls_related,
} from "../shared/matcher";
import {
  get_pending_attributions,
  get_settings,
  get_tab_referrers,
  get_tab_sources,
  save_attribution_candidates,
  save_pending_attributions,
  save_tab_referrers,
  save_tab_sources,
} from "../shared/storage";
import type {
  AppSettings,
  ContentMessage,
  DownloadContext,
  PendingAttribution,
  TabSourceInfo,
} from "../shared/types";
import { build_context_from_urls } from "./classifier";
import {
  build_attribution_candidates,
  is_inquiry_site,
} from "./attribution-candidates";

type NavigationDetails = chrome.webNavigation.WebNavigationFramedCallbackDetails &
  Partial<chrome.webNavigation.WebNavigationTransitionCallbackDetails>;

let memory_pending: PendingAttribution[] = [];
let memory_tab_sources: Record<number, TabSourceInfo> = {};
let memory_tab_referrers: Record<number, string> = {};
let memory_settings: AppSettings | null = null;

export async function init_attribution_cache(): Promise<void> {
  memory_settings = await get_settings();
  memory_pending = await get_pending_attributions();
  memory_tab_sources = await get_tab_sources();
  memory_tab_referrers = await get_tab_referrers();
}

export function refresh_settings_cache(settings: AppSettings): void {
  memory_settings = settings;
}

function prune_pending(pending: PendingAttribution[]): PendingAttribution[] {
  const now = Date.now();
  return pending.filter((item) => item.expires_at > now);
}

async function persist_pending(): Promise<void> {
  await save_pending_attributions(memory_pending);
}

async function persist_tab_sources(): Promise<void> {
  await save_tab_sources(memory_tab_sources);
}

async function persist_tab_referrers(): Promise<void> {
  await save_tab_referrers(memory_tab_referrers);
}

function reset_tab_context(tab_id: number, url: string): TabSourceInfo {
  const site = extract_hostname(url);
  return {
    source_site: site,
    source_page_url: url,
    source_page_title: "",
    entry_site: site,
    entry_page_url: url,
    updated_at: Date.now(),
  };
}

export async function record_link_click(message: Extract<ContentMessage, { type: "LINK_CLICKED" }>): Promise<void> {
  const settings = memory_settings ?? (await get_settings());
  const ttl_ms = settings.attribution.pending_ttl_minutes * 60 * 1000;
  const to_hostname = extract_hostname(message.to_url);
  memory_pending = prune_pending(memory_pending);

  memory_pending.push({
    from_site: message.from_site,
    from_page_url: message.from_page_url,
    from_page_title: message.from_page_title,
    to_url: message.to_url,
    to_hostname,
    clicked_at: Date.now(),
    expires_at: Date.now() + ttl_ms,
  });

  await persist_pending();
}

export async function record_page_referrer(
  message: Extract<ContentMessage, { type: "PAGE_REFERRER" }>
): Promise<void> {
  if (!message.tab_id || message.tab_id < 0 || !message.referrer) {
    return;
  }

  memory_tab_referrers[message.tab_id] = message.referrer;
  await persist_tab_referrers();
}

export async function record_tab_opener(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || tab.id < 0 || !tab.openerTabId || tab.openerTabId < 0) {
    return;
  }

  try {
    const opener = await chrome.tabs.get(tab.openerTabId);
    if (!opener.url) {
      return;
    }

    memory_tab_sources[tab.id] = {
      source_site: extract_hostname(opener.url),
      source_page_url: opener.url,
      source_page_title: opener.title ?? "",
      entry_site: extract_hostname(opener.url),
      entry_page_url: opener.url,
      updated_at: Date.now(),
    };
    await persist_tab_sources();
  } catch {
    // opener tab may be closed
  }
}

export async function record_navigation(details: NavigationDetails): Promise<void> {
  if (details.frameId !== 0 || details.tabId < 0) {
    return;
  }

  const transition = details.transitionType;
  const is_fresh_navigation =
    transition === "typed" ||
    transition === "auto_bookmark" ||
    transition === "generated" ||
    transition === "reload";

  if (is_fresh_navigation) {
    memory_tab_sources[details.tabId] = reset_tab_context(details.tabId, details.url);
    delete memory_tab_referrers[details.tabId];
    await persist_tab_sources();
    await persist_tab_referrers();
    return;
  }

  const existing = memory_tab_sources[details.tabId];

  if (!existing) {
    memory_tab_sources[details.tabId] = reset_tab_context(details.tabId, details.url);
    await persist_tab_sources();
    return;
  }

  if (transition === "link" || transition === "form_submit") {
    const next_site = extract_hostname(details.url);
    const same_site = next_site === existing.entry_site;

    if (same_site) {
      existing.entry_page_url = details.url;
      existing.updated_at = Date.now();
      memory_tab_sources[details.tabId] = existing;
    } else {
      existing.source_site = existing.entry_site || existing.source_site;
      existing.source_page_url = existing.entry_page_url || existing.source_page_url;
      existing.entry_site = next_site;
      existing.entry_page_url = details.url;
      existing.updated_at = Date.now();
      memory_tab_sources[details.tabId] = existing;
    }
    await persist_tab_sources();
  }
}

export function download_matches_page_context(
  download_url: string,
  download_site: string,
  page_url: string,
  page_site: string
): boolean {
  if (!page_site) {
    return false;
  }
  if (download_site === page_site) {
    return true;
  }
  return urls_related(download_url, page_url);
}

type DownloadItemWithTab = chrome.downloads.DownloadItem & { tabId?: number };

function get_download_tab_id(item: chrome.downloads.DownloadItem): number | undefined {
  const tab_id = (item as DownloadItemWithTab).tabId;
  if (tab_id !== undefined && tab_id >= 0) {
    return tab_id;
  }
  return undefined;
}

export function resolve_download_context_sync(
  item: chrome.downloads.DownloadItem
): DownloadContext {
  memory_pending = prune_pending(memory_pending);

  const download_url = item.finalUrl || item.url;
  const download_site = extract_hostname(download_url);

  const tab_id = get_download_tab_id(item);
  if (tab_id !== undefined) {
    const tab_ctx = memory_tab_sources[tab_id];
    if (tab_ctx?.entry_site) {
      return build_context_from_urls(
        item.id,
        download_url,
        tab_ctx.entry_site,
        tab_ctx.entry_page_url,
        tab_ctx.source_page_title,
        "navigation_chain",
        "high"
      );
    }
  }

  const referrer = item.referrer ?? "";

  const referrer_site = extract_hostname(referrer);
  if (referrer_site) {
    return build_context_from_urls(
      item.id,
      download_url,
      referrer_site,
      referrer,
      "",
      "referrer",
      "medium"
    );
  }

  return build_context_from_urls(
    item.id,
    download_url,
    download_site,
    referrer || download_url,
    "",
    "download_url_fallback",
    "low"
  );
}

export async function resolve_download_context(
  item: chrome.downloads.DownloadItem
): Promise<DownloadContext> {
  const sync_context = resolve_download_context_sync(item);
  if (
    sync_context.attribution_method === "navigation_chain" &&
    sync_context.attribution_confidence === "high"
  ) {
    return sync_context;
  }

  const download_url = item.finalUrl || item.url;
  const download_site = extract_hostname(download_url);

  const tab_id = get_download_tab_id(item);
  if (tab_id !== undefined) {
    try {
      const tab = await chrome.tabs.get(tab_id);
      const tab_site = extract_hostname(tab.url ?? "");
      if (tab.url?.startsWith("http") && tab_site) {
        return build_context_from_urls(
          item.id,
          download_url,
          tab_site,
          tab.url,
          tab.title ?? "",
          "navigation_chain",
          "high"
        );
      }
    } catch {
      // tab may be closed
    }
  }

  if (sync_context.attribution_method !== "download_url_fallback") {
    return sync_context;
  }

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  for (const tab of tabs) {
    if (!tab.id || !tab.url) {
      continue;
    }

    const tab_site = extract_hostname(tab.url);
    if (download_matches_page_context(download_url, download_site, tab.url, tab_site)) {
      return build_context_from_urls(
        item.id,
        download_url,
        tab_site,
        tab.url,
        tab.title ?? "",
        "navigation_chain",
        "medium"
      );
    }
  }

  return sync_context;
}

export async function store_attribution_candidates_for_download(
  item: chrome.downloads.DownloadItem
): Promise<void> {
  const settings = memory_settings ?? (await get_settings());
  const download_site = extract_hostname(item.finalUrl || item.url);

  if (!settings.attribution.inquiry_enabled) {
    return;
  }
  if (!is_inquiry_site(download_site, settings.attribution.inquiry_sites)) {
    return;
  }

  memory_pending = prune_pending(memory_pending);
  const candidates = build_attribution_candidates(
    item.finalUrl || item.url,
    download_site,
    item.referrer ?? "",
    memory_pending,
    memory_tab_sources,
    settings.attribution.pending_ttl_minutes * 60 * 1000
  );

  await save_attribution_candidates(item.id, candidates);
}

export function register_attribution_listeners(): void {
  chrome.tabs.onCreated.addListener((tab) => {
    void record_tab_opener(tab);
  });

  chrome.tabs.onRemoved.addListener((tab_id) => {
    delete memory_tab_sources[tab_id];
    delete memory_tab_referrers[tab_id];
    void persist_tab_sources();
    void persist_tab_referrers();
  });

  chrome.webNavigation.onCommitted.addListener((details) => {
    void record_navigation(details as NavigationDetails);
  });

  chrome.runtime.onMessage.addListener((message: ContentMessage, sender) => {
    if (message.type === "LINK_CLICKED") {
      void record_link_click(message);
    }

    if (message.type === "PAGE_REFERRER") {
      const tab_id = sender.tab?.id;
      void record_page_referrer({ ...message, tab_id });
    }
  });
}
