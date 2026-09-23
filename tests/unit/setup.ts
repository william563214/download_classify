import messages from "../../public/_locales/zh_TW/messages.json";

type message_entry = { message: string; placeholders?: Record<string, { content: string }> };

function apply_substitutions(template: string, substitutions?: string | string[]): string {
  if (substitutions == null) {
    return template;
  }
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  let result = template;
  values.forEach((value, index) => {
    result = result.replaceAll(`$${index + 1}$`, value);
  });
  return result;
}

const catalog = messages as Record<string, message_entry>;

const chrome_mock = {
  i18n: {
    getMessage(key: string, substitutions?: string | string[]): string {
      const entry = catalog[key];
      if (!entry) {
        return "";
      }
      return apply_substitutions(entry.message, substitutions);
    },
    getUILanguage(): string {
      return "zh-TW";
    },
  },
};

Object.assign(globalThis, { chrome: chrome_mock });
