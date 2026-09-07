import { extract_extension } from "./matcher";
import type { ClassificationRule, DownloadRecord, RuleMatchers } from "./types";

export interface RuleFormInput {
  name: string;
  target_folder: string;
  priority: number;
  use_source_site: boolean;
  use_download_site: boolean;
  use_extension: boolean;
  use_filename: boolean;
  record: DownloadRecord;
}

export function suggest_rule_defaults(record: DownloadRecord): {
  use_source_site: boolean;
  use_download_site: boolean;
  use_extension: boolean;
  use_filename: boolean;
  name: string;
  target_folder: string;
  priority: number;
} {
  const extension = extract_extension(record.original_filename);
  const has_distinct_source =
    Boolean(record.attributed_site) && record.attributed_site !== record.download_site;

  return {
    use_source_site: has_distinct_source,
    use_download_site: !has_distinct_source && Boolean(record.download_site),
    use_extension: Boolean(extension),
    use_filename: false,
    name: has_distinct_source ? `${record.attributed_site} 下載` : record.category || "新分類",
    target_folder: record.target_folder || "Others",
    priority: 50,
  };
}

export function build_rule_from_form(input: RuleFormInput): ClassificationRule {
  const matchers: RuleMatchers = {};

  if (input.use_source_site && input.record.attributed_site) {
    matchers.source_site = [input.record.attributed_site];
  }

  if (input.use_download_site && input.record.download_site) {
    matchers.site = [input.record.download_site];
  }

  if (input.use_extension) {
    const extension = extract_extension(input.record.original_filename);
    if (extension) {
      matchers.extension = [extension];
    }
  }

  if (input.use_filename && input.record.original_filename) {
    matchers.filename = [input.record.original_filename];
  }

  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim() || "新分類",
    target_folder: input.target_folder.trim() || "Others",
    priority: input.priority,
    enabled: true,
    matchers,
  };
}
