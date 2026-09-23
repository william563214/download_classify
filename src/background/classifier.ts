import { fallback_folder } from "../shared/constants";
import { t } from "../shared/i18n";
import {
  extract_basename,
  extract_extension,
  extract_hostname,
  matches_any_pattern,
  url_matches,
} from "../shared/matcher";
import type {
  ClassificationResult,
  ClassificationRule,
  DownloadContext,
  ExtensionRule,
  SiteClassificationRule,
} from "../shared/types";
import { classify_by_site } from "../shared/site-classifier";

export interface ClassifyInput {
  context: DownloadContext;
  filename: string;
  rules: ClassificationRule[];
  site_rules: SiteClassificationRule[];
  extension_rules: ExtensionRule[];
}

function rule_matches(rule: ClassificationRule, input: ClassifyInput): boolean {
  const basename = extract_basename(input.filename);
  const extension = extract_extension(input.filename);
  const matchers = rule.matchers;

  const checks: boolean[] = [];

  if (matchers.site?.length) {
    checks.push(
      matches_any_pattern(input.context.download_site, matchers.site) ||
        matches_any_pattern(input.context.download_url, matchers.site)
    );
  }

  if (matchers.source_site?.length) {
    checks.push(matches_any_pattern(input.context.attributed_site, matchers.source_site));
  }

  if (matchers.source_page?.length) {
    checks.push(
      matchers.source_page.some((pattern) =>
        url_matches(input.context.attributed_page_url, pattern)
      )
    );
  }

  if (matchers.filename?.length) {
    checks.push(matches_any_pattern(basename, matchers.filename));
  }

  if (matchers.extension?.length) {
    checks.push(
      matchers.extension.some((item) => item.toLowerCase() === extension)
    );
  }

  if (!checks.length) {
    return false;
  }

  return checks.some(Boolean);
}

function classify_by_extension(
  extension: string,
  extension_rules: ExtensionRule[]
): ClassificationResult | null {
  const match = extension_rules.find(
    (rule) => rule.extension.toLowerCase() === extension.toLowerCase()
  );
  if (!match) {
    return null;
  }

  return {
    category: match.name,
    target_folder: match.target_folder,
    matched_rule_id: `ext:${match.extension}`,
  };
}

function heuristic_fallback(input: ClassifyInput): ClassificationResult {
  const basename = extract_basename(input.filename);
  const { attributed_site, attributed_page_url } = input.context;

  if (attributed_site) {
    return {
      category: attributed_site,
      target_folder: `Sites/${sanitize_path_segment(attributed_site)}`,
      matched_rule_id: null,
    };
  }

  if (attributed_page_url) {
    try {
      const pathname = new URL(attributed_page_url).pathname;
      const segment = pathname.split("/").filter(Boolean)[0];
      if (segment) {
        return {
          category: segment,
          target_folder: `Pages/${sanitize_path_segment(segment)}`,
          matched_rule_id: null,
        };
      }
    } catch {
      // ignore invalid url
    }
  }

  const name_without_ext = basename.replace(/\.[^.]+$/, "");
  if (name_without_ext) {
    return {
      category: name_without_ext,
      target_folder: `Names/${sanitize_path_segment(name_without_ext)}`,
      matched_rule_id: null,
    };
  }

  return {
    category: t("categoryOthers"),
    target_folder: fallback_folder,
    matched_rule_id: null,
  };
}

function sanitize_path_segment(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "_").slice(0, 64);
}

export function classify_download(input: ClassifyInput): ClassificationResult {
  const site_result = classify_by_site(input.context, input.site_rules);
  if (site_result) {
    return site_result;
  }

  const enabled_rules = [...input.rules]
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of enabled_rules) {
    if (rule_matches(rule, input)) {
      return {
        category: rule.name,
        target_folder: rule.target_folder,
        matched_rule_id: rule.id,
      };
    }
  }

  const extension = extract_extension(input.filename);
  const extension_result = classify_by_extension(extension, input.extension_rules);
  if (extension_result) {
    return extension_result;
  }

  return heuristic_fallback(input);
}

export function build_context_from_urls(
  download_id: number,
  download_url: string,
  attributed_site: string,
  attributed_page_url: string,
  attributed_page_title: string,
  attribution_method: DownloadContext["attribution_method"],
  attribution_confidence: DownloadContext["attribution_confidence"]
): DownloadContext {
  return {
    download_id,
    download_url,
    download_site: extract_hostname(download_url),
    attributed_site,
    attributed_page_url,
    attributed_page_title,
    attribution_method,
    attribution_confidence,
  };
}
