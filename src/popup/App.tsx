import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import "./popup.css";

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  targetLanguage: "ko"
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

  const languageOptions = useMemo(() => LANGUAGE_OPTIONS, []);

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_SETTINGS).then((settings) => {
      setEnabled(Boolean(settings.enabled));
      setTargetLanguage(settings.targetLanguage ?? DEFAULT_SETTINGS.targetLanguage);
    });
  }, []);

  const persistSettings = async (nextEnabled: boolean, nextLanguage: string) => {
    await chrome.storage.sync.set({
      enabled: nextEnabled,
      targetLanguage: nextLanguage
    });
  };

  const handleEnabledChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextEnabled = event.target.checked;
    setEnabled(nextEnabled);
    void persistSettings(nextEnabled, targetLanguage);
  };

  const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLanguage = event.target.value;
    setTargetLanguage(nextLanguage);
    void persistSettings(enabled, nextLanguage);
  };

  return (
    <main className="popup">
      <h1>Udemy Dual Subtitle Translator</h1>

      <label className="field row" htmlFor="enabled">
        <span>Translation Switch</span>
        <input
          id="enabled"
          type="checkbox"
          checked={enabled}
          onChange={handleEnabledChange}
        />
      </label>

      <label className="field" htmlFor="targetLanguage">
        <span>Translation Language</span>
        <select
          id="targetLanguage"
          value={targetLanguage}
          onChange={handleLanguageChange}
        >
          {languageOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <p className="hint">* Translation will be displayed below the original captions.</p>
    </main>
  );
}
