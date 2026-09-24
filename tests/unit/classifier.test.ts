import { describe, expect, it } from "vitest";
import { classify_download, build_context_from_urls } from "../../src/background/classifier";
import type {
  ClassificationRule,
  DownloadContext,
  ExtensionRule,
  SiteClassificationRule,
} from "../../src/shared/types";

function make_context(overrides: Partial<DownloadContext> = {}): DownloadContext {
  return {
    download_id: 1,
    download_url: "https://cdn.example.com/file.zip",
    download_site: "cdn.example.com",
    attributed_site: "fantia.jp",
    attributed_page_url: "https://fantia.jp/posts/1",
    attributed_page_title: "post",
    attribution_method: "referrer",
    attribution_confidence: "medium",
    ...overrides,
  };
}

const empty_rules: ClassificationRule[] = [];
const empty_site: SiteClassificationRule[] = [];
const empty_ext: ExtensionRule[] = [];

describe("classify_download priority", () => {
  it("prefers site classification over custom rules", () => {
    const site_rules: SiteClassificationRule[] = [
      {
        id: "s1",
        name: "Fantia",
        host: "fantia.jp",
        target_folder: "Sites/Fantia",
        match_target: "source",
        priority: 10,
        enabled: true,
      },
    ];
    const rules: ClassificationRule[] = [
      {
        id: "c1",
        name: "Custom",
        target_folder: "Custom",
        priority: 1,
        enabled: true,
        matchers: { source_site: ["fantia.jp"] },
      },
    ];

    const result = classify_download({
      context: make_context(),
      filename: "a.zip",
      rules,
      site_rules,
      extension_rules: empty_ext,
    });

    expect(result.target_folder).toBe("Sites/Fantia");
    expect(result.matched_rule_id).toBe("site:s1");
  });

  it("matches custom rules with OR matchers and priority order", () => {
    const rules: ClassificationRule[] = [
      {
        id: "later",
        name: "Later",
        target_folder: "Later",
        priority: 20,
        enabled: true,
        matchers: { filename: ["a.zip"] },
      },
      {
        id: "earlier",
        name: "Earlier",
        target_folder: "Earlier",
        priority: 5,
        enabled: true,
        matchers: {
          site: ["no-match.example"],
          filename: ["a.zip"],
        },
      },
    ];

    const result = classify_download({
      context: make_context({ attributed_site: "" }),
      filename: "a.zip",
      rules,
      site_rules: empty_site,
      extension_rules: empty_ext,
    });

    expect(result.matched_rule_id).toBe("earlier");
    expect(result.target_folder).toBe("Earlier");
  });

  it("uses extension rules when no site or custom match", () => {
    const extension_rules: ExtensionRule[] = [
      { name: "壓縮檔", extension: "zip", target_folder: "Archives" },
    ];

    const result = classify_download({
      context: make_context({ attributed_site: "", attributed_page_url: "" }),
      filename: "pack.ZIP",
      rules: empty_rules,
      site_rules: empty_site,
      extension_rules,
    });

    expect(result.target_folder).toBe("Archives");
    expect(result.matched_rule_id).toBe("ext:zip");
  });

  it("falls back to attributed site heuristic then others", () => {
    const with_site = classify_download({
      context: make_context({ attributed_site: "fanbox.cc" }),
      filename: "x.bin",
      rules: empty_rules,
      site_rules: empty_site,
      extension_rules: empty_ext,
    });
    expect(with_site.target_folder).toBe("Sites/fanbox.cc");
    expect(with_site.matched_rule_id).toBeNull();

    const others = classify_download({
      context: make_context({
        attributed_site: "",
        attributed_page_url: "",
      }),
      filename: "",
      rules: empty_rules,
      site_rules: empty_site,
      extension_rules: empty_ext,
    });
    expect(others.target_folder).toBe("Others");
    expect(others.category).toBe("其他");
  });

  it("skips disabled site and custom rules", () => {
    const site_rules: SiteClassificationRule[] = [
      {
        id: "off",
        name: "Off",
        host: "fantia.jp",
        target_folder: "Off",
        match_target: "either",
        priority: 1,
        enabled: false,
      },
    ];
    const rules: ClassificationRule[] = [
      {
        id: "off-custom",
        name: "OffCustom",
        target_folder: "OffCustom",
        priority: 1,
        enabled: false,
        matchers: { source_site: ["fantia.jp"] },
      },
    ];

    const result = classify_download({
      context: make_context(),
      filename: "a.pdf",
      rules,
      site_rules,
      extension_rules: [{ name: "文件", extension: "pdf", target_folder: "Documents" }],
    });

    expect(result.matched_rule_id).toBe("ext:pdf");
  });
});

describe("build_context_from_urls", () => {
  it("fills download_site from download url", () => {
    const context = build_context_from_urls(
      9,
      "https://mega.nz/file/1",
      "forum.test",
      "https://forum.test/t/1",
      "thread",
      "link_click",
      "high"
    );
    expect(context.download_id).toBe(9);
    expect(context.download_site).toBe("mega.nz");
    expect(context.attributed_site).toBe("forum.test");
  });
});
