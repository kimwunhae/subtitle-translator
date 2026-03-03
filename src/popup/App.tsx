import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import "./popup.css";
import { resolveUiLanguage, t } from "./i18n";

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  targetLanguage: "ko",
  preserveTerms: []
};

type LanguageOptionWithLabel = LanguageOption & {
  labelMessageKey: string;
};

const LANGUAGE_OPTIONS: LanguageOptionWithLabel[] = [
  { code: "ko", label: "한국어", labelMessageKey: "langKo" },
  { code: "en", label: "English", labelMessageKey: "langEn" },
  { code: "ja", label: "日本語", labelMessageKey: "langJa" },
  { code: "zh-CN", label: "中文(简体)", labelMessageKey: "langZhCN" },
  { code: "zh-TW", label: "中文(繁體)", labelMessageKey: "langZhTW" },
  { code: "es", label: "Español", labelMessageKey: "langEs" },
  { code: "fr", label: "Français", labelMessageKey: "langFr" },
  { code: "de", label: "Deutsch", labelMessageKey: "langDe" },
  { code: "it", label: "Italiano", labelMessageKey: "langIt" },
  { code: "pt", label: "Português", labelMessageKey: "langPt" },
  { code: "ru", label: "Русский", labelMessageKey: "langRu" },
  { code: "vi", label: "Tiếng Việt", labelMessageKey: "langVi" },
  { code: "id", label: "Bahasa Indonesia", labelMessageKey: "langId" },
  { code: "th", label: "ไทย", labelMessageKey: "langTh" }
];

export default function App() {
  const [enabled, setEnabled] = useState(DEFAULT_SETTINGS.enabled);
  const [targetLanguage, setTargetLanguage] = useState(
    DEFAULT_SETTINGS.targetLanguage
  );
  const [preserveTermsText, setPreserveTermsText] = useState("");

  const languageOptions = useMemo(
    () =>
      LANGUAGE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.labelMessageKey, option.label),
      })),
    [],
  );

  useEffect(() => {
    document.title = t("popupTitle", "Udemy Dual Subtitle Translator");
    document.documentElement.lang = resolveUiLanguage();
  }, []);

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_SETTINGS).then((settings) => {
      setEnabled(Boolean(settings.enabled));
      setTargetLanguage(settings.targetLanguage ?? DEFAULT_SETTINGS.targetLanguage);
      setPreserveTermsText((settings.preserveTerms ?? []).join("\n"));
    });
  }, []);

  const parsePreserveTerms = (value: string) =>
    [...new Set(value.split("\n").map((term) => term.trim()).filter(Boolean))];

  const persistSettings = async (next: Settings) => {
    await chrome.storage.sync.set(next);
  };

  const handleEnabledChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextEnabled = event.target.checked;
    setEnabled(nextEnabled);
    void persistSettings({
      enabled: nextEnabled,
      targetLanguage,
      preserveTerms: parsePreserveTerms(preserveTermsText)
    });
  };

  const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLanguage = event.target.value;
    setTargetLanguage(nextLanguage);
    void persistSettings({
      enabled,
      targetLanguage: nextLanguage,
      preserveTerms: parsePreserveTerms(preserveTermsText)
    });
  };

  const handlePreserveTermsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setPreserveTermsText(nextValue);
    void persistSettings({
      enabled,
      targetLanguage,
      preserveTerms: parsePreserveTerms(nextValue)
    });
  };

  return (
    <main className="popup">
      <header className="popup-header">
        <p className="eyebrow">{t("popupTitle", "Udemy Dual Subtitle Translator")}</p>
        <h1>{t("popupTitleHeading", "Dual Subtitle Control")}</h1>
        <p className="subhead">{t("popupSubhead", "Display translated subtitles below the original subtitles.")}</p>
      </header>

      <section className="panel">
        <label className="field row" htmlFor="enabled">
          <span className="field-title">{t("translationToggle", "Translation")}</span>
          <span className="switch">
            <input
              id="enabled"
              type="checkbox"
              checked={enabled}
              onChange={handleEnabledChange}
            />
            <span className="slider" aria-hidden="true" />
          </span>
        </label>

        <label className="field" htmlFor="targetLanguage">
          <span className="field-title">{t("targetLanguage", "Target Language")}</span>
          <select
            id="targetLanguage"
            value={targetLanguage}
            onChange={handleLanguageChange}
            disabled={!enabled}
          >
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field" htmlFor="preserveTerms">
          <span className="field-title">{t("preserveTerms", "Preserve Terms")}</span>
          <textarea
            id="preserveTerms"
            value={preserveTermsText}
            onChange={handlePreserveTermsChange}
            placeholder={t("preserveTermsPlaceholder", "React\nNode.js\nKubernetes")}
            rows={4}
          />
          <span className="field-help">
            {t(
              "preserveTermsHelp",
              "Enter one term per line to keep it unchanged during translation.",
            )}
          </span>
        </label>
      </section>

      <p className="hint">
        {enabled
          ? t(
              "translationEnabledHint",
              "Translated subtitles are automatically shown under the original subtitles.",
            )
          : t(
              "translationDisabledHint",
              "Translation is disabled. Enable it with the toggle.",
            )}
      </p>
    </main>
  );
}
