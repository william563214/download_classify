import fs from "node:fs";
import { test, expect } from "@playwright/test";
import {
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

test.describe("e2e E5 hard rule 3 — extension/heuristic still unclassified", () => {
  test("E5a extension-only match stays unclassified and opens classify prompt", async () => {
    const { context, service_worker, user_data_dir, extension_id } =
      await launch_extension_context();
    try {
      await seed_storage(context, extension_id, {
        site_rules: [],
        rules: [],
        extension_rules: [
          { name: "Archives", extension: "zip", target_folder: "Archives" },
        ],
        settings: prompt_settings,
      });

      await trigger_download_and_wait(mock_hosts.fanbox, context);

      const record = await wait_for_download_record(
        service_worker,
        (item) => String(item.download_site || "").includes("fanbox")
      );

      // hard rule 3: extension match must still count as unclassified
      expect(String(record.matched_rule_id)).toMatch(/^ext:/);
      expect(record.target_folder).toBe("Archives");
      expect(record.is_unclassified).toBe(true);

      const classify_page = await wait_for_classify_page(context);
      await expect(classify_page.locator("#page-title")).toContainText(/分類|Classify/);
      await expect(classify_page.locator("#save-rule")).toBeVisible();
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

      // fantia fixture is .bin — no extension rule; classifier falls to Others/heuristic
      await trigger_download_and_wait(mock_hosts.fantia, context);

      const record = await wait_for_download_record(
        service_worker,
        (item) => String(item.download_site || "").includes("fantia")
      );

      expect(record.matched_rule_id).toBeNull();
      expect(record.is_unclassified).toBe(true);

      const classify_page = await wait_for_classify_page(context);
      await expect(classify_page.locator("#page-title")).toContainText(/分類|Classify/);
      await expect(classify_page.locator("#save-rule")).toBeVisible();
    } finally {
      await context.close();
      fs.rmSync(user_data_dir, { recursive: true, force: true });
    }
  });

  test("E5c site-rule match is classified (contrast)", async () => {
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
        (item) => String(item.download_site || "").includes("fantia")
      );

      expect(String(record.matched_rule_id)).toContain("site:");
      expect(record.target_folder).toBe("Sites/Fantia");
      expect(record.is_unclassified).toBe(false);
    } finally {
      await context.close();
      fs.rmSync(user_data_dir, { recursive: true, force: true });
    }
  });
});
