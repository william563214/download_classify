import type { RenameOptions } from "./types";
import { extract_basename } from "./matcher";

export function apply_rename(
  basename: string,
  attributed_site: string,
  rename: RenameOptions
): string {
  if (!rename.add_source_domain || !attributed_site) {
    return basename;
  }

  const domain = sanitize_domain(attributed_site);
  if (!domain) {
    return basename;
  }

  const dot_index = basename.lastIndexOf(".");
  const has_extension = dot_index > 0;
  const name_part = has_extension ? basename.slice(0, dot_index) : basename;
  const extension_part = has_extension ? basename.slice(dot_index) : "";

  if (rename.domain_position === "suffix") {
    return `${name_part}${rename.separator}${domain}${extension_part}`;
  }

  return `${domain}${rename.separator}${name_part}${extension_part}`;
}

export function build_classified_path(
  target_folder: string,
  original_filename: string,
  attributed_site: string,
  rename: RenameOptions
): string {
  const basename = extract_basename(original_filename);
  const renamed = apply_rename(basename, attributed_site, rename);
  const folder = target_folder.replace(/^\/+|\/+$/g, "");
  return folder ? `${folder}/${renamed}` : renamed;
}

function sanitize_domain(domain: string): string {
  return domain.replace(/[<>:"/\\|?*]/g, "_");
}
