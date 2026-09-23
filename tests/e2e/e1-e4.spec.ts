import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  assert_download_not_moved,
  delay,
  get_chrome_downloads,
  get_download_records,
  get_local_storage,
  install_download_mutation_probe,
  launch_extension_context,
  mock_hosts,
  require_chrome_download,
  seed_storage,
  trigger_download_and_wait,
  wait_for_classify_page,
  wait_for_download_record,
  find_classify_pages,
} from "../helpers/extension";

test.describe.configure({ mode: "serial" });

test.describe("e2e E1-E4", () => {
  test("E1 site classification uses folder and skips classify prompt", async () => {
    const { context, service_worker, user_data_dir, extension_id } =
      await launch_extension_context();
    try {
      await seed_storage(context, extension_id, {
        site_rules: [
          {
            id: "site-fantia",
            name: "Fantia",
            host: "fantia.test",
            target_folder: "Sites/Fantia",
            match_target: "download",
            priority: 1,
            enabled: true,
          },
        ],
        rules: [],
        settings: {
          rename: { add_source_domain: false, domain_position: "prefix", separator: "_" },
          attribution: {
            pending_ttl_minutes: 10,
            known_file_hosts: ["mega.test"],
            inquiry_sites: ["mega.test"],
            inquiry_enabled: true,
          },
          unclassified_prompt: { enabled: true },
          history_imported: true,
        },
      });

      const { download } = await trigger_download_and_wait(mock_hosts.fantia, context);
      await download.saveAs(path.join(user_data_dir, "e1-saved.bin")).catch(() => undefined);

      const record = await wait_for_download_record(
        service_worker,
        (item) => String(item.download_site || "").includes("fantia")
      );
      expect(record.target_folder).toBe("Sites/Fantia");
      expect(record.is_unclassified).toBe(false);
      expect(String(record.matched_rule_id)).toContain("site:");

      const chrome_downloads = await get_chrome_downloads(service_worker);
      expect(chrome_downloads.some((item) => item.url.includes("fantia.test"))).toBe(true);

      await delay(1500);
      expect(find_classify_pages(context).length).toBe(0);
    } finally {
      await context.close();
      fs.rmSync(user_data_dir, { recursive: true, force: true });
    }
  });

  test("E2 no site rules shows unclassified prompt", async () => {
    const { context, service_worker, user_data_dir, extension_id } =
      await launch_extension_context();
    try {
      await seed_storage(context, extension_id, {
        site_rules: [],
        rules: [],
        extension_rules: [],
        settings: {
          rename: { add_source_domain: false, domain_position: "prefix", separator: "_" },
          attribution: {
            pending_ttl_minutes: 10,
            known_file_hosts: ["mega.test"],
            inquiry_sites: ["mega.test"],
            inquiry_enabled: false,
          },
          unclassified_prompt: { enabled: true },
          history_imported: true,
        },
      });

      await trigger_download_and_wait(mock_hosts.fanbox, context);
      const classify_page = await wait_for_classify_page(context);
      await expect(classify_page.locator("#page-title")).toContainText(/分類/);

      const record = await wait_for_download_record(
        service_worker,
        (item) => String(item.download_site || "").includes("fanbox")
      );
      expect(record.is_unclassified).toBe(true);
    } finally {
      await context.close();
      fs.rmSync(user_data_dir, { recursive: true, force: true });
    }
  });

  test("E3 saving domain rule classifies next download and does not move saved file", async () => {
    const { context, service_worker, user_data_dir, extension_id } =
      await launch_extension_context();
    try {
      await seed_storage(context, extension_id, {
        site_rules: [],
        rules: [],
        extension_rules: [],
        settings: {
          rename: { add_source_domain: false, domain_position: "prefix", separator: "_" },
          attribution: {
            pending_ttl_minutes: 10,
            known_file_hosts: ["mega.test"],
            inquiry_sites: ["mega.test"],
            inquiry_enabled: false,
          },
          unclassified_prompt: { enabled: true },
          history_imported: true,
        },
      });
      await install_download_mutation_probe(service_worker);

      const first = await trigger_download_and_wait(mock_hosts.fanbox, context);
      const saved_path = path.join(user_data_dir, "e3-first.bin");
      await first.download.saveAs(saved_path);
      expect(fs.existsSync(saved_path)).toBe(true);
      const size_before = fs.statSync(saved_path).size;
      expect(size_before).toBeGreaterThan(0);

      const path_before = await require_chrome_download(service_worker, "fanbox.test");
      expect(path_before.filename.length).toBeGreaterThan(0);

      const classify_page = await wait_for_classify_page(context);
      await classify_page.locator("#rule-name").fill("FANBOX");
      await classify_page.locator("#rule-folder").fill("Sites/FANBOX");
      await classify_page.locator("#match-download-site").check();
      await classify_page.locator("#match-source-site").uncheck();
      await classify_page.locator("#match-extension").uncheck();
      await classify_page.locator("#match-filename").uncheck();
      await classify_page.locator("#save-rule").click();

      await expect
        .poll(async () => {
          const stored = await get_local_storage(service_worker, ["rules"]);
          const rules = (stored.rules as Array<{ target_folder: string }>) || [];
          return rules.some((rule) => rule.target_folder === "Sites/FANBOX");
        })
        .toBe(true);

      // hard rule: saving a rule must not move the already-downloaded file
      await assert_download_not_moved(service_worker, path_before);
      expect(fs.existsSync(saved_path)).toBe(true);
      expect(fs.statSync(saved_path).size).toBe(size_before);

      for (const page of find_classify_pages(context)) {
        await page.close().catch(() => undefined);
      }

      await trigger_download_and_wait(mock_hosts.fanbox, context);
      const record = await wait_for_download_record(
        service_worker,
        (item) => item.target_folder === "Sites/FANBOX" && item.is_unclassified === false
      );
      expect(record.target_folder).toBe("Sites/FANBOX");
      expect(record.is_unclassified).toBe(false);

      // first download path must still be unchanged after the second download
      await assert_download_not_moved(service_worker, path_before);
      expect(fs.existsSync(saved_path)).toBe(true);
      expect(fs.statSync(saved_path).size).toBe(size_before);

      await delay(1500);
      expect(find_classify_pages(context).length).toBe(0);
    } finally {
      await context.close();
      fs.rmSync(user_data_dir, { recursive: true, force: true });
    }
  });

  test("E4 attribution inquiry confirms without moving file", async () => {
    const { context, service_worker, user_data_dir, extension_id } =
      await launch_extension_context();
    try {
      await seed_storage(context, extension_id, {
        site_rules: [],
        rules: [],
        extension_rules: [],
        settings: {
          rename: { add_source_domain: false, domain_position: "prefix", separator: "_" },
          attribution: {
            pending_ttl_minutes: 10,
            known_file_hosts: ["mega.test"],
            inquiry_sites: ["mega.test"],
            inquiry_enabled: true,
          },
          unclassified_prompt: { enabled: false },
          history_imported: true,
        },
      });
      await install_download_mutation_probe(service_worker);

      const forum_page = await context.newPage();
      await forum_page.goto(mock_hosts.forum, { waitUntil: "domcontentloaded" });
      await forum_page.locator("#outbound-link").click();
      await forum_page.waitForURL(/mega\.test/);
      await delay(500);

      const [download] = await Promise.all([
        forum_page.waitForEvent("download", { timeout: 30_000 }),
        forum_page.locator("#download-link").click(),
      ]);
      const saved_path = path.join(user_data_dir, "e4-before.bin");
      await download.saveAs(saved_path);
      expect(fs.existsSync(saved_path)).toBe(true);
      const size_before = fs.statSync(saved_path).size;
      expect(size_before).toBeGreaterThan(0);

      const path_before = await require_chrome_download(service_worker, "mega.test");
      expect(path_before.filename.length).toBeGreaterThan(0);

      const classify_page = await wait_for_classify_page(context);
      await expect(classify_page.locator("#page-title")).toContainText(/歸因/);
      await expect(classify_page.locator('input[name="attribution-choice"]')).not.toHaveCount(0);

      const radios = classify_page.locator('input[name="attribution-choice"]');
      const radio_count = await radios.count();
      let selected_forum = false;
      for (let index = 0; index < radio_count; index += 1) {
        const radio = radios.nth(index);
        const value = await radio.getAttribute("value");
        if (value && value.includes("forum.test")) {
          await radio.check();
          selected_forum = true;
          break;
        }
      }
      expect(selected_forum).toBe(true);

      const confirm = classify_page.locator("#confirm-attribution");
      await expect(confirm).toBeVisible();
      await confirm.click();

      await expect
        .poll(async () => {
          const records = await get_download_records(service_worker);
          const latest = records.find((item) =>
            String(item.download_site || "").includes("mega")
          );
          return latest?.attributed_site;
        })
        .toBe("forum.test");

      // hard rule: confirm attribution must not move the downloaded file
      await assert_download_not_moved(service_worker, path_before);
      expect(fs.existsSync(saved_path)).toBe(true);
      expect(fs.statSync(saved_path).size).toBe(size_before);
    } finally {
      await context.close();
      fs.rmSync(user_data_dir, { recursive: true, force: true });
    }
  });
});
