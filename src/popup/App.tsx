import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import "./popup.css";

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  targetLanguage: "ko",
  preserveTerms: []
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh-CN", label: "中文(简体)" },
  { code: "zh-TW", label: "中文(繁體)" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "th", label: "ไทย" }
];

export default function App() {
  const [enabled, setEnabled] = useState(DEFAULT_SETTINGS.enabled);
  const [targetLanguage, setTargetLanguage] = useState(
    DEFAULT_SETTINGS.targetLanguage
  );
  const [preserveTermsText, setPreserveTermsText] = useState("");

  const languageOptions = useMemo(() => LANGUAGE_OPTIONS, []);

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
        <p className="eyebrow">Udemy Dual Subtitle Translator</p>
        <h1>Dual Subtitle Control</h1>
        <p className="subhead">원본 자막 아래에 번역 자막을 함께 표시합니다.</p>
      </header>

      <section className="panel">
        <label className="field row" htmlFor="enabled">
          <span className="field-title">Translation</span>
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
          <span className="field-title">Target Language</span>
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
          <span className="field-title">Preserve Terms</span>
          <textarea
            id="preserveTerms"
            value={preserveTermsText}
            onChange={handlePreserveTermsChange}
            placeholder={"React\nNode.js\nKubernetes"}
            rows={4}
          />
          <span className="field-help">
            한 줄에 하나씩 입력하면 번역 시 원문 그대로 유지됩니다.
          </span>
        </label>
      </section>

      <p className="hint">
        {enabled
          ? "번역 자막이 원본 자막 아래에 자동으로 표시됩니다."
          : "번역이 비활성화되어 있습니다. 토글을 켜서 사용하세요."}
      </p>
    </main>
  );
}
