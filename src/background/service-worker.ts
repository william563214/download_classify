import { register_attribution_listeners, init_attribution_cache } from "./attribution";
import { resolve_current_site_status_for_active_tab } from "./site-status-resolver";
import { upsert_site_classification } from "./site-rule-actions";
import { register_download_handlers, init_download_cache } from "./download-handler";
import { import_download_history } from "./history-importer";
import { save_rule_from_unclassified, confirm_attribution_only } from "./unclassified-actions";
import {
  dismiss_unclassified_prompt,
  open_classify_prompt,
  register_unclassified_window_listener,
} from "./unclassified-prompt";
import {
  get_attribution_candidates,
  get_download_record,
  get_unclassified_downloads,
  init_storage,
} from "../shared/storage";
import type { RuntimeMessage } from "../shared/types";

async function bootstrap(): Promise<void> {
  await init_storage();
  await init_attribution_cache();
  await init_download_cache();
  register_attribution_listeners();
  register_download_handlers();
  register_unclassified_window_listener();
}

void bootstrap();

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") {
    void import_download_history();
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type === "IMPORT_HISTORY") {
    void import_download_history(Boolean(message.force)).then(sendResponse);
    return true;
  }

  if (message?.type === "REFRESH_CACHE") {
    void Promise.all([init_attribution_cache(), init_download_cache()]).then(() =>
      sendResponse({ ok: true })
    );
    return true;
  }

  if (message?.type === "GET_UNCLASSIFIED_DOWNLOAD") {
    void get_download_record(message.download_id).then(sendResponse);
    return true;
  }

  if (message?.type === "GET_UNCLASSIFIED_DOWNLOADS") {
    void get_unclassified_downloads().then(sendResponse);
    return true;
  }

  if (message?.type === "OPEN_CLASSIFY_PROMPT") {
    void open_classify_prompt(message.download_id).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "DISMISS_UNCLASSIFIED") {
    void dismiss_unclassified_prompt(message.download_id).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "GET_ATTRIBUTION_CANDIDATES") {
    void get_attribution_candidates(message.download_id).then(sendResponse);
    return true;
  }

  if (message?.type === "CONFIRM_ATTRIBUTION") {
    void confirm_attribution_only(message.download_id, message.selected_attribution_id).then(
      sendResponse
    );
    return true;
  }

  if (message?.type === "GET_CURRENT_SITE_STATUS") {
    void resolve_current_site_status_for_active_tab().then(sendResponse);
    return true;
  }

  if (message?.type === "SAVE_SITE_CLASSIFICATION") {
    void upsert_site_classification(message.payload).then(sendResponse);
    return true;
  }

  if (message?.type === "SAVE_RULE_FROM_UNCLASSIFIED") {
    void save_rule_from_unclassified(message.payload).then(sendResponse);
    return true;
  }

  return false;
});
