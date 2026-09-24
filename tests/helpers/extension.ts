import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext, type Worker } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repo_root = path.resolve(__dirname, "../..");

export const mock_port = 18765;
export const mock_hosts = {
  fantia: `http://fantia.test:${mock_port}/`,
  fanbox: `http://fanbox.test:${mock_port}/`,
  mega: `http://mega.test:${mock_port}/`,
  forum: `http://forum.test:${mock_port}/`,
} as const;

const host_resolver_rules = [
  `MAP fantia.test 127.0.0.1`,
  `MAP fanbox.test 127.0.0.1`,
  `MAP mega.test 127.0.0.1`,
  `MAP forum.test 127.0.0.1`,
].join(",");

export function dist_path(): string {
  return path.join(repo_root, "dist");
}

export function assert_dist_ready(): void {
  const manifest = path.join(dist_path(), "manifest.json");
  if (!fs.existsSync(manifest)) {
    throw new Error("dist/manifest.json missing — run npm run build first");
  }
}

export async function launch_extension_context(): Promise<{
  context: BrowserContext;
  user_data_dir: string;
  downloads_dir: string;
  extension_id: string;
  service_worker: Worker;
}> {
  assert_dist_ready();
  const user_data_dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-ext-"));
  const downloads_dir = path.join(user_data_dir, "downloads");
  fs.mkdirSync(downloads_dir, { recursive: true });

  const headed = process.env.E2E_HEADED === "1" || Boolean(process.env.DISPLAY);
  const context = await chromium.launchPersistentContext(user_data_dir, {
    // MV3 extensions: prefer headed/xvfb; otherwise try headless=new
    headless: !headed,
    acceptDownloads: true,
    downloadsPath: downloads_dir,
    args: [
      `--disable-extensions-except=${dist_path()}`,
      `--load-extension=${dist_path()}`,
      `--host-resolver-rules=${host_resolver_rules}`,
      "--no-first-run",
      "--no-default-browser-check",
      ...(headed ? [] : ["--headless=new"]),
    ],
  });

  let service_worker = context.serviceWorkers()[0];
  if (!service_worker) {
    service_worker = await context.waitForEvent("serviceworker", { timeout: 30_000 });
  }

  const extension_id = new URL(service_worker.url()).host;
  return { context, user_data_dir, downloads_dir, extension_id, service_worker };
}

export async function seed_storage(
  context: BrowserContext,
  extension_id: string,
  payload: Record<string, unknown>
): Promise<void> {
  const page = await context.newPage();
  try {
    await page.goto(`chrome-extension://${extension_id}/src/popup/popup.html`, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(async (data) => {
      await chrome.storage.local.set(data);
      await chrome.runtime.sendMessage({ type: "REFRESH_CACHE" });
    }, payload);
  } finally {
    await page.close();
  }
}

export async function get_local_storage(
  service_worker: Worker,
  keys: string[]
): Promise<Record<string, unknown>> {
  return service_worker.evaluate(async (storage_keys) => {
    return chrome.storage.local.get(storage_keys);
  }, keys);
}

export async function get_download_records(
  service_worker: Worker
): Promise<Array<Record<string, unknown>>> {
  return service_worker.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("download_classify_db", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("download_records")) {
          resolve([]);
          return;
        }
        const tx = db.transaction("download_records", "readonly");
        const store = tx.objectStore("download_records");
        const get_all = store.getAll();
        get_all.onsuccess = () => resolve(get_all.result as Array<Record<string, unknown>>);
        get_all.onerror = () => reject(get_all.error);
      };
    });
  });
}

export type chrome_download_snapshot = {
  id: number;
  filename: string;
  url: string;
  state: string;
};

export async function get_chrome_downloads(
  service_worker: Worker
): Promise<chrome_download_snapshot[]> {
  return service_worker.evaluate(async () => {
    const items = await chrome.downloads.search({});
    return items.map((item) => ({
      id: item.id,
      filename: item.filename ?? "",
      url: item.url,
      state: item.state ?? "",
    }));
  });
}

export async function require_chrome_download(
  service_worker: Worker,
  url_substr: string,
  timeout_ms = 20_000
): Promise<chrome_download_snapshot> {
  const started = Date.now();
  while (Date.now() - started < timeout_ms) {
    const items = await get_chrome_downloads(service_worker);
    const match = items.find((item) => item.url.includes(url_substr) && item.filename);
    if (match) {
      return match;
    }
    await delay(250);
  }
  throw new Error(`timed out waiting for chrome.downloads item containing ${url_substr}`);
}

export async function install_download_mutation_probe(service_worker: Worker): Promise<void> {
  await service_worker.evaluate(() => {
    const g = globalThis as typeof globalThis & {
      __dc_download_mutations?: Array<{ api: string; args: unknown[] }>;
    };
    g.__dc_download_mutations = [];
    const downloads = chrome.downloads as typeof chrome.downloads & {
      move?: (...args: unknown[]) => unknown;
      erase?: (...args: unknown[]) => unknown;
    };
    for (const api of ["move", "erase"] as const) {
      const original = downloads[api];
      if (typeof original !== "function") {
        continue;
      }
      downloads[api] = ((...args: unknown[]) => {
        g.__dc_download_mutations!.push({ api, args });
        return (original as (...inner: unknown[]) => unknown).apply(downloads, args);
      }) as typeof original;
    }
  });
}

export async function get_download_mutations(
  service_worker: Worker
): Promise<Array<{ api: string; args: unknown[] }>> {
  return service_worker.evaluate(() => {
    const g = globalThis as typeof globalThis & {
      __dc_download_mutations?: Array<{ api: string; args: unknown[] }>;
    };
    return g.__dc_download_mutations ?? [];
  });
}

/** Hard assert: confirm-attribution / save-rule must not relocate the completed download. */
export async function assert_download_not_moved(
  service_worker: Worker,
  before: chrome_download_snapshot
): Promise<void> {
  if (!before.filename) {
    throw new Error("assert_download_not_moved requires a non-empty before.filename");
  }
  const after_items = await get_chrome_downloads(service_worker);
  const after = after_items.find((item) => item.id === before.id);
  if (!after) {
    throw new Error(`download id ${before.id} disappeared after action (possible erase/move)`);
  }
  if (!after.filename) {
    throw new Error(`download id ${before.id} lost filename after action`);
  }
  if (after.filename !== before.filename) {
    throw new Error(
      `download path changed after action (must not move file):\n before: ${before.filename}\n after:  ${after.filename}`
    );
  }
  const mutations = await get_download_mutations(service_worker);
  const forbidden = mutations.filter((item) => item.api === "move" || item.api === "erase");
  if (forbidden.length) {
    throw new Error(`forbidden chrome.downloads mutations: ${JSON.stringify(forbidden)}`);
  }
}

export async function wait_for_download_record(
  service_worker: Worker,
  predicate: (record: Record<string, unknown>) => boolean,
  timeout_ms = 20_000
): Promise<Record<string, unknown>> {
  const started = Date.now();
  while (Date.now() - started < timeout_ms) {
    const records = await get_download_records(service_worker);
    const match = records.find((record) => predicate(record));
    if (match) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("timed out waiting for download record");
}

export function find_classify_pages(context: BrowserContext) {
  return context.pages().filter((page) => page.url().includes("classify.html"));
}

export async function wait_for_classify_page(context: BrowserContext, timeout_ms = 25_000) {
  const existing = find_classify_pages(context)[0];
  if (existing) {
    await existing.waitForLoadState("domcontentloaded");
    return existing;
  }
  const page = await context.waitForEvent("page", {
    timeout: timeout_ms,
    predicate: (candidate) => candidate.url().includes("classify.html"),
  });
  await page.waitForLoadState("domcontentloaded");
  return page;
}

export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function trigger_download_and_wait(page_url: string, context: BrowserContext) {
  const page = await context.newPage();
  await page.goto(page_url, { waitUntil: "domcontentloaded" });
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    page.locator("#download-link").click(),
  ]);
  return { page, download };
}
