import { describe, expect, it } from "vitest";
import {
  extract_basename,
  extract_extension,
  extract_hostname,
  host_matches_site,
  is_known_file_host,
  matches_any_pattern,
  matches_pattern,
  url_matches,
  urls_related,
} from "../../src/shared/matcher";

describe("extract_hostname", () => {
  it("parses http urls", () => {
    expect(extract_hostname("https://fantia.jp/posts/1")).toBe("fantia.jp");
  });

  it("returns empty for invalid or empty input", () => {
    expect(extract_hostname("")).toBe("");
    expect(extract_hostname("not-a-url")).toBe("");
  });
});

describe("extract_extension", () => {
  it("returns lowercase extension from basename or path", () => {
    expect(extract_extension("photo.PNG")).toBe("png");
    expect(extract_extension("C:\\\\Downloads\\\\pack.ZIP")).toBe("zip");
  });

  it("returns empty when missing or leading-only dot", () => {
    expect(extract_extension("README")).toBe("");
    expect(extract_extension(".gitignore")).toBe("");
  });
});

describe("extract_basename", () => {
  it("strips directory separators", () => {
    expect(extract_basename("/tmp/a/b/file.txt")).toBe("file.txt");
    expect(extract_basename("folder\\\\nested\\\\x.bin")).toBe("x.bin");
  });
});

describe("matches_pattern and wildcards", () => {
  it("matches exact and wildcard host patterns", () => {
    expect(matches_pattern("fantia.jp", "fantia.jp")).toBe(true);
    expect(matches_pattern("cdn.fantia.jp", "*.fantia.jp")).toBe(true);
    expect(matches_pattern("example.com", "*.fantia.jp")).toBe(false);
  });

  it("matches_any_pattern returns false for empty inputs", () => {
    expect(matches_any_pattern("a", [])).toBe(false);
    expect(matches_any_pattern("", ["*"])).toBe(false);
  });
});

describe("host_matches_site", () => {
  it("matches bare host and subdomain forms", () => {
    expect(host_matches_site("fantia.jp", "fantia.jp")).toBe(true);
    expect(host_matches_site("www.fantia.jp", "fantia.jp")).toBe(true);
    expect(host_matches_site("cdn.fantia.jp", "*.fantia.jp")).toBe(true);
    expect(host_matches_site("evilfantia.jp", "fantia.jp")).toBe(false);
  });
});

describe("url_matches", () => {
  it("applies wildcard patterns case-insensitively", () => {
    expect(url_matches("https://FANBOX.CC/posts/1", "https://fanbox.cc/*")).toBe(true);
    expect(url_matches("https://other.test/a", "https://fanbox.cc/*")).toBe(false);
  });
});

describe("is_known_file_host", () => {
  it("matches exact and subdomain hosts", () => {
    const known = ["mega.nz", "mediafire.com"];
    expect(is_known_file_host("mega.nz", known)).toBe(true);
    expect(is_known_file_host("user.mediafire.com", known)).toBe(true);
    expect(is_known_file_host("example.com", known)).toBe(false);
  });
});

describe("urls_related", () => {
  it("treats identical urls and same hostname as related", () => {
    const a = "https://mega.nz/file/abc";
    expect(urls_related(a, a)).toBe(true);
    expect(urls_related(a, "https://mega.nz/file/xyz")).toBe(true);
  });

  it("returns false for empty or unrelated hosts", () => {
    expect(urls_related("", "https://a.test")).toBe(false);
    expect(urls_related("https://a.test/x", "https://b.test/x")).toBe(false);
  });
});
