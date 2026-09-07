import {
  dismiss_unclassified_download,
  get_attribution_candidates,
  get_download_record,
  get_settings,
} from "../shared/storage";
import type { DownloadRecord } from "../shared/types";
import { is_inquiry_site } from "./attribution-candidates";

const open_prompts = new Map<number, number>();

function classify_page_url(download_id: number): string {
  return chrome.runtime.getURL(`src/classify/classify.html?download_id=${download_id}`);
}

export async function needs_classification_prompt(record: DownloadRecord): Promise<boolean> {
  if (record.imported || record.rule_prompt_dismissed) {
    return false;
  }
  const settings = await get_settings();
  if (!settings.unclassified_prompt?.enabled) {
    return false;
  }
  return record.is_unclassified;
}

export async function needs_attribution_inquiry(record: DownloadRecord): Promise<boolean> {
  const settings = await get_settings();
  if (!settings.attribution.inquiry_enabled) {
    return false;
  }
  if (record.imported || record.attribution_inquiry_dismissed) {
    return false;
  }
  if (!is_inquiry_site(record.download_site, settings.attribution.inquiry_sites)) {
    return false;
  }
  const candidates = await get_attribution_candidates(record.download_id);
  return candidates.length > 0;
}

export async function should_prompt_for_record(record: DownloadRecord): Promise<boolean> {
  if (record.imported) {
    return false;
  }
  return (
    (await needs_classification_prompt(record)) || (await needs_attribution_inquiry(record))
  );
}

export async function open_classify_prompt(download_id: number, force = false): Promise<void> {
  const record = await get_download_record(download_id);
  if (!record) {
    return;
  }

  if (!force && !(await should_prompt_for_record(record))) {
    return;
  }

  if (open_prompts.has(download_id)) {
    const window_id = open_prompts.get(download_id);
    if (window_id !== undefined) {
      try {
        await chrome.windows.update(window_id, { focused: true });
        return;
      } catch {
        open_prompts.delete(download_id);
      }
    }
  }

  try {
    const created = await chrome.windows.create({
      url: classify_page_url(download_id),
      type: "popup",
      width: 560,
      height: 720,
      focused: true,
    });

    if (created.id !== undefined) {
      open_prompts.set(download_id, created.id);
    }
    return;
  } catch {
    // fallback when popup window cannot be created
  }

  await chrome.tabs.create({
    url: classify_page_url(download_id),
    active: true,
  });
}

export async function maybe_prompt_after_download(record: DownloadRecord): Promise<void> {
  const fresh = await get_download_record(record.download_id);
  if (!fresh || fresh.state !== "complete") {
    return;
  }

  if (!(await should_prompt_for_record(fresh))) {
    return;
  }

  await open_classify_prompt(fresh.download_id);
}

export async function close_classify_window(download_id: number): Promise<void> {
  const window_id = open_prompts.get(download_id);
  if (window_id !== undefined) {
    try {
      await chrome.windows.remove(window_id);
    } catch {
      // window already closed
    }
    open_prompts.delete(download_id);
  }
}

export async function dismiss_unclassified_prompt(download_id: number): Promise<void> {
  await dismiss_unclassified_download(download_id);
  await close_classify_window(download_id);
}

export function register_unclassified_window_listener(): void {
  chrome.windows.onRemoved.addListener((window_id) => {
    for (const [download_id, tracked_id] of open_prompts.entries()) {
      if (tracked_id === window_id) {
        open_prompts.delete(download_id);
      }
    }
  });
}
