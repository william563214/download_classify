export function extract_hostname(input: string): string {
  if (!input) {
    return "";
  }

  try {
    return new URL(input).hostname;
  } catch {
    return "";
  }
}

export function extract_extension(filename: string): string {
  const basename = filename.split(/[/\\]/).pop() ?? filename;
  const dot_index = basename.lastIndexOf(".");
  if (dot_index <= 0) {
    return "";
  }
  return basename.slice(dot_index + 1).toLowerCase();
}

export function extract_basename(filename: string): string {
  return filename.split(/[/\\]/).pop() ?? filename;
}

function escape_regex(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

export function pattern_to_regex(pattern: string): RegExp {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) {
    return /^$/;
  }

  const parts = normalized.split("*").map(escape_regex);
  return new RegExp(`^${parts.join(".*")}$`, "i");
}

export function matches_pattern(value: string, pattern: string): boolean {
  if (!value || !pattern) {
    return false;
  }
  return pattern_to_regex(pattern).test(value.trim());
}

export function matches_any_pattern(value: string, patterns: string[] | undefined): boolean {
  if (!patterns?.length || !value) {
    return false;
  }
  return patterns.some((pattern) => matches_pattern(value, pattern));
}

export function host_matches_site(hostname: string, pattern: string): boolean {
  if (!hostname || !pattern) {
    return false;
  }

  const lower = hostname.toLowerCase().trim();
  const normalized = pattern.toLowerCase().trim();
  if (!normalized) {
    return false;
  }

  if (matches_pattern(lower, normalized)) {
    return true;
  }

  const bare = normalized.replace(/^\*\./, "");
  return lower === bare || lower.endsWith(`.${bare}`);
}

export function url_matches(url: string, pattern: string): boolean {
  return matches_pattern(url.toLowerCase(), pattern.toLowerCase());
}

export function is_known_file_host(hostname: string, known_hosts: string[]): boolean {
  const lower = hostname.toLowerCase();
  return known_hosts.some(
    (host) => lower === host || lower.endsWith(`.${host}`)
  );
}

export function urls_related(download_url: string, candidate_url: string): boolean {
  if (!download_url || !candidate_url) {
    return false;
  }

  if (download_url === candidate_url) {
    return true;
  }

  const download_hostname = extract_hostname(download_url);
  const candidate_hostname = extract_hostname(candidate_url);

  if (download_hostname && candidate_hostname && download_hostname === candidate_hostname) {
    return true;
  }

  try {
    const download = new URL(download_url);
    const candidate = new URL(candidate_url);
    return download.origin === candidate.origin;
  } catch {
    return download_url.startsWith(candidate_url) || candidate_url.startsWith(download_url);
  }
}
