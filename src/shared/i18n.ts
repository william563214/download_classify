export function t(key: string, substitutions?: string | string[]): string {
  try {
    const message = chrome?.i18n?.getMessage?.(key, substitutions);
    if (message) {
      return message;
    }
  } catch {
    // chrome.i18n unavailable outside extension runtime
  }
  return key;
}

export function apply_document_i18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (!key) {
      return;
    }
    element.textContent = t(key);
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (!key || !("placeholder" in element)) {
      return;
    }
    (element as HTMLInputElement).placeholder = t(key);
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((element) => {
    const key = element.dataset.i18nTitle;
    if (!key) {
      return;
    }
    element.setAttribute("title", t(key));
  });

  const title_el = document.querySelector("title[data-i18n]");
  if (title_el instanceof HTMLTitleElement && title_el.dataset.i18n) {
    document.title = t(title_el.dataset.i18n);
  }

  const ui_locale = chrome.i18n.getUILanguage?.() ?? "";
  if (ui_locale) {
    document.documentElement.lang = ui_locale.replace("_", "-");
  }
}
