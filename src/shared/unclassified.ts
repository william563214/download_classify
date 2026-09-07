import type { ClassificationResult, ClassificationRule } from "./types";

function rule_has_site_scope(rule: ClassificationRule): boolean {
  const matchers = rule.matchers;
  return Boolean(
    matchers.source_site?.length || matchers.site?.length || matchers.source_page?.length
  );
}

export function is_unclassified_result(
  classification: ClassificationResult,
  rules: ClassificationRule[] = []
): boolean {
  const rule_id = classification.matched_rule_id;

  if (!rule_id || rule_id.startsWith("ext:")) {
    return true;
  }

  if (rule_id.startsWith("site:")) {
    return false;
  }

  const rule = rules.find((item) => item.id === rule_id);
  if (!rule) {
    return true;
  }

  return !rule_has_site_scope(rule);
}
