import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import {
  delay,
  find_classify_pages,
  get_chrome_downloads,
  launch_extension_context,
  mock_hosts,
  seed_storage,
  trigger_download_and_wait,
  wait_for_classify_page,
  wait_for_download_record,
} from "../helpers/extension";

test.describe.configure({ mode: "serial" });

const prompt_settings = {
  rename: { add_source_domain: false, domain_position: "prefix", separator: "_" },
  attribution: {
    pending_ttl_minutes: 10,
    known_file_hosts: ["mega.test"],
    inquiry_sites: ["mega.test"],
    inquiry_enabled: false,
  },
  unclassified_prompt: { enabled: true },
  history_imported: true,
} as const;

/** Wait until classify.html has loaded the record (not just static chrome). */
async function assert_classify_prompt_loaded(
  classify_page: Page,
  record: Record<string, unknown>
): Promise<void> {
  const download_id = record.download_id;
  expect(download_id).toEqual(expect.any(Number));
  expect(classify_page.url()).toContain(`download_id=${download_id}`);

  await expect(classify_page.locator("#rule-form")).toBeVisible();
  await expect(classify_page.locator("#not-found")).toBeHidden();
  await expect(classify_page.locator("#info-category")).toContainText(
    String(record.target_folder)
  );
}

/**
 * Hard-assert classification branch + folder for hard rule 3.
 * Prefer ext:zip when Chromium supplies a .zip basename at classify time
 * otherwise record the heuristic branch Playwright/CDP actually takes.
 */
function assert_extension_or_heuristic_branch(record: Record<string, unknown>): void {
  expect(record.is_unclassified).toBe(true);
  const rule_id = record.matched_rule_id;
  if (rule_id === "ext:zip") {
    expect(record.target_folder).toBe("Archives");
    return;
  }
  // Branch taken under Playwright: onCreated filename is empty so classifier
  // falls through to attributed-site heuristic before .zip arrives onChanged.
  expect(rule_id).toBeNull();
  expect(String(record.target_folder)).toMatch(/^Sites\//);
}

test.describe("e2e E5 hard rule 3 — extension/heuristic still unclassified", () => {
  test("E5a with extension_rules seeded still unclassified and opens classify prompt", async () => {
    const { context, service_worker, user_data_dir, extension_id } =
      await launch_extension_context();
    try {
      await seed_storage(context, extension_id, {
        site_rules: [],
        rules: [],
        // Fixture is creator-pack.zip with Content-Disposition + download attr.
        // Under Playwright/CDP, chrome.downloads.onCreated still sees filename ""
        // so the live path is usually heuristic; ext:zip is asserted when present.
        extension_rules: [
          { name: "Archives", extension: "zip", target_folder: "Archives" },
        ],
        settings: prompt_settings,
      });

      await trigger_download_and_wait(mock_hosts.fanbox, context);

      const record = await wait_for_download_record(
        service_worker,
        (item) =>
          String(item.download_site || "").includes("fanbox") && item.state === "complete"
      );

      const chrome_items = await get_chrome_downloads(service_worker);
      expect(chrome_items.some((item) => item.url.includes("creator-pack.zip"))).toBe(true);

      assert_extension_or_heuristic_branch(record);

      const classify_page = await wait_for_classify_page(context);
      await assert_classify_prompt_loaded(classify_page, record);
    } finally {
      await context.close();
      fs.rmSync(user_data_dir, { recursive: true, force: true });
    }
  });

  test("E5b heuristic-only match stays unclassified and opens classify prompt", async () => {
    const { context, service_worker, user_data_dir, extension_id } =
      await launch_extension_context();
    try {
      await seed_storage(context, extension_id, {
        site_rules: [],
        rules: [],
        extension_rules: [],
        settings: prompt_settings,
      });

      // fantia fixture is .bin — no extension rule; attributed-site heuristic → Sites/…
      await trigger_download_and_wait(mock_hosts.fantia, context);

      const record = await wait_for_download_record(
        service_worker,
        (item) =>
          String(item.download_site || "").includes("fantia") && item.state === "complete"
      );

      expect(record.matched_rule_id).toBeNull();
      expect(record.is_unclassified).toBe(true);
      expect(String(record.target_folder)).toMatch(/^Sites\//);

      const classify_page = await wait_for_classify_page(context);
      await assert_classify_prompt_loaded(classify_page, record);
    } finally {
      await context.close();
      fs.rmSync(user_data_dir, { recursive: true, force: true });
    }
  });

  test("E5c site-rule match is classified and skips classify prompt (contrast)", async () => {
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
        extension_rules: [
          { name: "BinFiles", extension: "bin", target_folder: "Binaries" },
        ],
        settings: prompt_settings,
      });

      await trigger_download_and_wait(mock_hosts.fantia, context);

      const record = await wait_for_download_record(
        service_worker,
        (item) =>
          String(item.download_site || "").includes("fantia") && item.state === "complete"
      );

      expect(record.matched_rule_id).toBe("site:site-fantia");
      expect(record.target_folder).toBe("Sites/Fantia");
      expect(record.is_unclassified).toBe(false);

      await delay(1500);
      expect(find_classify_pages(context).length).toBe(0);
    } finally {
      await context.close();
      fs.rmSync(user_data_dir, { recursive: true, force: true });
    }
  });
});
