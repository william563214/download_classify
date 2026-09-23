import {
  db_name,
  db_version,
  get_default_extension_rules,
  default_settings,
  records_store,
  storage_keys,
} from "./constants";
import type {
  AppSettings,
  ClassificationRule,
  DownloadRecord,
  ExtensionRule,
  PendingAttribution,
  SiteClassificationRule,
  TabSourceInfo,
} from "./types";
import type { AttributionCandidate } from "./attribution-candidate";

function get_local<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] as T | undefined);
    });
  });
}

function set_local(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
}

function get_session<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.session.get(key, (result) => {
      resolve(result[key] as T | undefined);
    });
  });
}

function set_session(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.session.set({ [key]: value }, () => resolve());
  });
}

let db_promise: Promise<IDBDatabase> | null = null;

function open_db(): Promise<IDBDatabase> {
  if (!db_promise) {
    db_promise = new Promise((resolve, reject) => {
      const request = indexedDB.open(db_name, db_version);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(records_store)) {
          const store = db.createObjectStore(records_store, { keyPath: "download_id" });
          store.createIndex("started_at", "started_at", { unique: false });
          store.createIndex("imported", "imported", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }
  return db_promise;
}

export async function init_storage(): Promise<void> {
  const settings = await get_local<AppSettings>(storage_keys.settings);
  if (!settings) {
    await set_local(storage_keys.settings, default_settings);
  }

  const rules = await get_local<ClassificationRule[]>(storage_keys.rules);
  if (!rules) {
    await set_local(storage_keys.rules, []);
  }

  const extension_rules = await get_local<ExtensionRule[]>(storage_keys.extension_rules);
  if (!extension_rules) {
    await set_local(storage_keys.extension_rules, get_default_extension_rules());
  }

  const site_rules = await get_local<SiteClassificationRule[]>(storage_keys.site_rules);
  if (!site_rules) {
    await set_local(storage_keys.site_rules, []);
  }

  await open_db();
}

export async function get_settings(): Promise<AppSettings> {
  const settings = await get_local<AppSettings>(storage_keys.settings);
  if (!settings) {
    return default_settings;
  }

  return {
    ...default_settings,
    ...settings,
    rename: { ...default_settings.rename, ...settings.rename },
    attribution: { ...default_settings.attribution, ...settings.attribution },
    unclassified_prompt: {
      ...default_settings.unclassified_prompt,
      ...settings.unclassified_prompt,
    },
  };
}

export async function save_settings(settings: AppSettings): Promise<void> {
  await set_local(storage_keys.settings, settings);
}

export async function get_rules(): Promise<ClassificationRule[]> {
  const rules = await get_local<ClassificationRule[]>(storage_keys.rules);
  return rules ?? [];
}

export async function save_rules(rules: ClassificationRule[]): Promise<void> {
  await set_local(storage_keys.rules, rules);
}

export async function get_site_rules(): Promise<SiteClassificationRule[]> {
  const rules = await get_local<SiteClassificationRule[]>(storage_keys.site_rules);
  return rules ?? [];
}

export async function save_site_rules(rules: SiteClassificationRule[]): Promise<void> {
  await set_local(storage_keys.site_rules, rules);
}

export async function get_extension_rules(): Promise<ExtensionRule[]> {
  const rules = await get_local<ExtensionRule[]>(storage_keys.extension_rules);
  return rules ?? get_default_extension_rules();
}

export async function save_extension_rules(rules: ExtensionRule[]): Promise<void> {
  await set_local(storage_keys.extension_rules, rules);
}

export async function get_pending_attributions(): Promise<PendingAttribution[]> {
  const pending = await get_session<PendingAttribution[]>(storage_keys.pending_attributions);
  return pending ?? [];
}

export async function save_pending_attributions(pending: PendingAttribution[]): Promise<void> {
  await set_session(storage_keys.pending_attributions, pending);
}

export async function get_tab_sources(): Promise<Record<number, TabSourceInfo>> {
  const sources = await get_session<Record<number, TabSourceInfo>>(storage_keys.tab_sources);
  return sources ?? {};
}

export async function save_tab_sources(sources: Record<number, TabSourceInfo>): Promise<void> {
  await set_session(storage_keys.tab_sources, sources);
}

export async function get_tab_referrers(): Promise<Record<number, string>> {
  const referrers = await get_session<Record<number, string>>(storage_keys.tab_referrers);
  return referrers ?? {};
}

export async function save_tab_referrers(referrers: Record<number, string>): Promise<void> {
  await set_session(storage_keys.tab_referrers, referrers);
}

export async function upsert_download_record(record: DownloadRecord): Promise<void> {
  const db = await open_db();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(records_store, "readwrite");
    tx.objectStore(records_store).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function get_download_record(download_id: number): Promise<DownloadRecord | null> {
  const db = await open_db();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(records_store, "readonly");
    const request = tx.objectStore(records_store).get(download_id);
    request.onsuccess = () => resolve((request.result as DownloadRecord) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function get_recent_downloads(limit = 20): Promise<DownloadRecord[]> {
  const db = await open_db();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(records_store, "readonly");
    const store = tx.objectStore(records_store);
    const index = store.index("started_at");
    const request = index.openCursor(null, "prev");
    const records: DownloadRecord[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || records.length >= limit) {
        resolve(records);
        return;
      }
      records.push(cursor.value as DownloadRecord);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function get_all_download_ids(): Promise<Set<number>> {
  const db = await open_db();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(records_store, "readonly");
    const request = tx.objectStore(records_store).getAllKeys();
    request.onsuccess = () => {
      const ids = new Set((request.result as number[]).map(Number));
      resolve(ids);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function get_today_category_stats(): Promise<Record<string, number>> {
  const db = await open_db();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const today_iso = today.toISOString();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(records_store, "readonly");
    const request = tx.objectStore(records_store).getAll();
    request.onsuccess = () => {
      const stats: Record<string, number> = {};
      for (const record of request.result as DownloadRecord[]) {
        if (record.started_at >= today_iso) {
          stats[record.category] = (stats[record.category] ?? 0) + 1;
        }
      }
      resolve(stats);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function count_download_records(): Promise<number> {
  const db = await open_db();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(records_store, "readonly");
    const request = tx.objectStore(records_store).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function get_dismissed_unclassified_ids(): Promise<Set<number>> {
  const dismissed = await get_session<number[]>(storage_keys.dismissed_unclassified);
  return new Set(dismissed ?? []);
}

export async function dismiss_unclassified_download(download_id: number): Promise<void> {
  const dismissed = await get_dismissed_unclassified_ids();
  dismissed.add(download_id);
  await set_session(storage_keys.dismissed_unclassified, [...dismissed]);

  const record = await get_download_record(download_id);
  if (record) {
    await upsert_download_record({
      ...record,
      rule_prompt_dismissed: true,
    });
  }
}

export async function get_unclassified_downloads(limit = 50): Promise<DownloadRecord[]> {
  const dismissed = await get_dismissed_unclassified_ids();
  const db = await open_db();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(records_store, "readonly");
    const index = tx.objectStore(records_store).index("started_at");
    const request = index.openCursor(null, "prev");
    const records: DownloadRecord[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(records);
        return;
      }

      const record = cursor.value as DownloadRecord;
      const is_unclassified =
        record.is_unclassified ??
        (record.matched_rule_id === null || record.matched_rule_id === undefined);
      const prompt_dismissed = record.rule_prompt_dismissed ?? dismissed.has(record.download_id);

      if (is_unclassified && !prompt_dismissed && !record.imported) {
        records.push({
          ...record,
          is_unclassified: true,
          matched_rule_id: record.matched_rule_id ?? null,
          rule_prompt_dismissed: false,
        });
      }

      if (records.length >= limit) {
        resolve(records);
        return;
      }

      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function mark_download_classified(
  download_id: number,
  category: string,
  target_folder: string,
  matched_rule_id: string
): Promise<void> {
  const record = await get_download_record(download_id);
  if (!record) {
    return;
  }

  await upsert_download_record({
    ...record,
    category,
    target_folder,
    matched_rule_id,
    is_unclassified: false,
    rule_prompt_dismissed: true,
  });
}

export async function save_attribution_candidates(
  download_id: number,
  candidates: AttributionCandidate[]
): Promise<void> {
  const all = await get_session<Record<number, AttributionCandidate[]>>(
    storage_keys.attribution_candidates
  );
  const map = all ?? {};
  map[download_id] = candidates;
  await set_session(storage_keys.attribution_candidates, map);
}

export async function get_attribution_candidates(
  download_id: number
): Promise<AttributionCandidate[]> {
  const all = await get_session<Record<number, AttributionCandidate[]>>(
    storage_keys.attribution_candidates
  );
  return all?.[download_id] ?? [];
}

export async function mark_attribution_inquiry_dismissed(download_id: number): Promise<void> {
  const record = await get_download_record(download_id);
  if (!record) {
    return;
  }
  await upsert_download_record({
    ...record,
    attribution_inquiry_dismissed: true,
  });
}

export async function update_download_attribution(
  download_id: number,
  site: string,
  page_url: string,
  page_title: string,
  method: DownloadRecord["attribution_method"],
  confidence: DownloadRecord["attribution_confidence"]
): Promise<void> {
  const record = await get_download_record(download_id);
  if (!record) {
    return;
  }

  await upsert_download_record({
    ...record,
    attributed_site: site,
    attributed_page_url: page_url,
    attributed_page_title: page_title,
    attribution_method: method,
    attribution_confidence: confidence,
  });
}
