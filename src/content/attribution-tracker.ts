import { default_known_file_hosts, storage_keys } from "../shared/constants";
import { is_known_file_host } from "../shared/matcher";
import type { AppSettings, ContentMessage } from "../shared/types";

let known_file_hosts = [...default_known_file_hosts];

function apply_known_hosts(settings: AppSettings | undefined): void {
  if (settings?.attribution?.known_file_hosts?.length) {
    known_file_hosts = settings.attribution.known_file_hosts;
  }
}

function load_known_hosts(): void {
  chrome.storage.local.get(storage_keys.settings, (result) => {
    apply_known_hosts(result[storage_keys.settings] as AppSettings | undefined);
  });
}

load_known_hosts();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[storage_keys.settings]) {
    return;
  }
  apply_known_hosts(changes[storage_keys.settings].newValue as AppSettings | undefined);
});

function send_message(message: ContentMessage): void {
  try {
    chrome.runtime.sendMessage(message);
  } catch {
    // extension context may be unavailable
  }
}

function should_track_link(href: string, current_hostname: string): boolean {
  try {
    const target = new URL(href, location.href);
    const target_hostname = target.hostname;
    if (!target_hostname) {
      return false;
    }
    if (target_hostname !== current_hostname) {
      return true;
    }
    return is_known_file_host(target_hostname, known_file_hosts);
  } catch {
    return false;
  }
}

document.addEventListener(
  "click",
  (event) => {
    const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) {
      return;
    }

    const href = anchor.href;
    if (!href || !should_track_link(href, location.hostname)) {
      return;
    }

    send_message({
      type: "LINK_CLICKED",
      from_site: location.hostname,
      from_page_url: location.href,
      from_page_title: document.title,
      to_url: href,
    });
  },
  true
);

function report_referrer(): void {
  if (!document.referrer) {
    return;
  }

  send_message({
    type: "PAGE_REFERRER",
    page_url: location.href,
    page_title: document.title,
    referrer: document.referrer,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", report_referrer);
} else {
  report_referrer();
}
