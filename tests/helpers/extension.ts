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
    // MV3 extensions need a real display path use xvfb-run for CI
    headless: !headed,
    acceptDownloads: true,
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

export async function get_chrome_downloads(
  service_worker: Worker
): Promise<Array<{ id: number; filename: string; url: string; state: string }>> {
  return service_worker.evaluate(async () => {
    const items = await chrome.downloads.search({});
    return items.map((item) => ({
      id: item.id,
      filename: item.filename,
      url: item.url,
      state: item.state ?? "",
    }));
  });
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
