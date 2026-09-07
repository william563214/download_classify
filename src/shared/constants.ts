import type { AppSettings, ClassificationRule, ExtensionRule } from "./types";

export const db_name = "download_classify_db";
export const db_version = 1;
export const records_store = "download_records";

export const storage_keys = {
  settings: "settings",
  rules: "rules",
  site_rules: "site_rules",
  extension_rules: "extension_rules",
  pending_attributions: "pending_attributions",
  tab_sources: "tab_sources",
  tab_referrers: "tab_referrers",
  dismissed_unclassified: "dismissed_unclassified",
  attribution_candidates: "attribution_candidates",
} as const;

export const default_rename = {
  add_source_domain: true,
  domain_position: "prefix" as const,
  separator: "_",
};

export const default_known_file_hosts = [
  "drive.google.com",
  "disk.yandex.com",
  "mega.nz",
  "mediafire.com",
  "pan.baidu.com",
  "dropbox.com",
  "onedrive.live.com",
  "sharepoint.com",
  "wetransfer.com",
  "sendspace.com",
  "box.com",
  "icloud.com",
];

export const default_unclassified_prompt = {
  enabled: true,
};

export const default_attribution_inquiry_sites = [
  "mega.nz",
  "mediafire.com",
  "drive.google.com",
  "dropbox.com",
  "pan.baidu.com",
];

export const default_settings: AppSettings = {
  rename: default_rename,
  attribution: {
    pending_ttl_minutes: 10,
    known_file_hosts: default_known_file_hosts,
    inquiry_sites: default_attribution_inquiry_sites,
    inquiry_enabled: true,
  },
  unclassified_prompt: default_unclassified_prompt,
  history_imported: false,
};

export const default_classification_rules: ClassificationRule[] = [];

export const default_extension_rules: ExtensionRule[] = [
  { name: "文件", extension: "pdf", target_folder: "Documents" },
  { name: "文件", extension: "doc", target_folder: "Documents" },
  { name: "文件", extension: "docx", target_folder: "Documents" },
  { name: "文件", extension: "xlsx", target_folder: "Documents" },
  { name: "文件", extension: "pptx", target_folder: "Documents" },
  { name: "壓縮檔", extension: "zip", target_folder: "Archives" },
  { name: "壓縮檔", extension: "rar", target_folder: "Archives" },
  { name: "壓縮檔", extension: "7z", target_folder: "Archives" },
  { name: "壓縮檔", extension: "tar", target_folder: "Archives" },
  { name: "壓縮檔", extension: "gz", target_folder: "Archives" },
  { name: "圖片", extension: "png", target_folder: "Media/Images" },
  { name: "圖片", extension: "jpg", target_folder: "Media/Images" },
  { name: "圖片", extension: "jpeg", target_folder: "Media/Images" },
  { name: "圖片", extension: "gif", target_folder: "Media/Images" },
  { name: "圖片", extension: "webp", target_folder: "Media/Images" },
  { name: "圖片", extension: "svg", target_folder: "Media/Images" },
  { name: "影片", extension: "mp4", target_folder: "Media/Video" },
  { name: "影片", extension: "mkv", target_folder: "Media/Video" },
  { name: "影片", extension: "avi", target_folder: "Media/Video" },
  { name: "影片", extension: "mov", target_folder: "Media/Video" },
  { name: "影片", extension: "webm", target_folder: "Media/Video" },
  { name: "音訊", extension: "mp3", target_folder: "Media/Audio" },
  { name: "音訊", extension: "flac", target_folder: "Media/Audio" },
  { name: "音訊", extension: "wav", target_folder: "Media/Audio" },
  { name: "音訊", extension: "aac", target_folder: "Media/Audio" },
];

export const fallback_folder = "Others";
