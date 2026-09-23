import { describe, expect, it } from "vitest";
import { is_unclassified_result } from "../../src/shared/unclassified";
import type { ClassificationResult, ClassificationRule } from "../../src/shared/types";

function result(
  matched_rule_id: string | null,
  overrides: Partial<ClassificationResult> = {}
): ClassificationResult {
  return {
    category: "x",
    target_folder: "X",
    matched_rule_id,
    ...overrides,
  };
}

describe("is_unclassified_result", () => {
  it("treats site classification as classified", () => {
    expect(is_unclassified_result(result("site:abc"))).toBe(false);
  });

  it("treats custom rules with site scope as classified", () => {
    const rules: ClassificationRule[] = [
      {
        id: "r1",
        name: "Domain",
        target_folder: "Domain",
        priority: 1,
        enabled: true,
        matchers: { source_site: ["fantia.jp"] },
      },
    ];
    expect(is_unclassified_result(result("r1"), rules)).toBe(false);
  });

  it("treats extension and heuristic results as unclassified", () => {
    expect(is_unclassified_result(result("ext:zip"))).toBe(true);
    expect(is_unclassified_result(result(null))).toBe(true);
  });

  it("treats custom rules without site scope as unclassified", () => {
    const rules: ClassificationRule[] = [
      {
        id: "r2",
        name: "ByExt",
        target_folder: "ByExt",
        priority: 1,
        enabled: true,
        matchers: { extension: ["zip"] },
      },
    ];
    expect(is_unclassified_result(result("r2"), rules)).toBe(true);
  });

  it("treats missing custom rule id as unclassified", () => {
    expect(is_unclassified_result(result("missing"), [])).toBe(true);
  });
});
