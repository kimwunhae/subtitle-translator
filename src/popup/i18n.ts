export function t(key: string, fallback: string) {
  const translated = chrome.i18n?.getMessage?.(key);
  return translated ? translated : fallback;
}

export function resolveUiLanguage() {
  const raw = chrome.i18n?.getUILanguage?.() ?? "en-US";
  const primary = raw.split(/[._-]/)[0] ?? "en";
  if (primary.toLowerCase() === "zh") {
    if (raw.toLowerCase().includes("tw")) {
      return "zh-TW";
    }
    return "zh-CN";
  }

  return raw.includes("en") ? "en" : primary;
}
