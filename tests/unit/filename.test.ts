import { describe, expect, it } from "vitest";
import { apply_rename, build_classified_path } from "../../src/shared/filename";
import type { RenameOptions } from "../../src/shared/types";

const prefix_rename: RenameOptions = {
  add_source_domain: true,
  domain_position: "prefix",
  separator: "_",
};

const suffix_rename: RenameOptions = {
  add_source_domain: true,
  domain_position: "suffix",
  separator: "-",
};

describe("apply_rename", () => {
  it("adds domain as prefix or suffix", () => {
    expect(apply_rename("photo.png", "fantia.jp", prefix_rename)).toBe("fantia.jp_photo.png");
    expect(apply_rename("photo.png", "fantia.jp", suffix_rename)).toBe("photo-fantia.jp.png");
  });

  it("skips rename when disabled or site empty", () => {
    expect(
      apply_rename("photo.png", "fantia.jp", { ...prefix_rename, add_source_domain: false })
    ).toBe("photo.png");
    expect(apply_rename("photo.png", "", prefix_rename)).toBe("photo.png");
  });
});

describe("build_classified_path", () => {
  it("joins folder and renamed basename", () => {
    expect(
      build_classified_path("Sites/Fantia", "/tmp/photo.png", "fantia.jp", prefix_rename)
    ).toBe("Sites/Fantia/fantia.jp_photo.png");
  });

  it("returns renamed basename when folder empty", () => {
    expect(build_classified_path("", "a.bin", "mega.nz", prefix_rename)).toBe("mega.nz_a.bin");
  });
});
