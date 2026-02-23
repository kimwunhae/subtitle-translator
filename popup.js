const DEFAULT_SETTINGS = {
  enabled: true,
  targetLanguage: "ko"
};

const LANGUAGE_OPTIONS = [
  ["ko", "한국어"],
  ["en", "English"],
  ["ja", "日本語"],
  ["zh-CN", "中文(简体)"],
  ["zh-TW", "中文(繁體)"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["it", "Italiano"],
  ["pt", "Português"],
  ["ru", "Русский"],
  ["vi", "Tiếng Việt"],
  ["id", "Bahasa Indonesia"],
  ["th", "ไทย"]
];

const enabledInput = document.querySelector("#enabled");
const targetLanguageSelect = document.querySelector("#targetLanguage");

function populateLanguageOptions() {
  const optionsFragment = document.createDocumentFragment();

  LANGUAGE_OPTIONS.forEach(([code, label]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = label;
    optionsFragment.appendChild(option);
  });

  targetLanguageSelect.appendChild(optionsFragment);
}

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  enabledInput.checked = Boolean(settings.enabled);
  targetLanguageSelect.value = settings.targetLanguage;
}

async function saveSettings() {
  const nextSettings = {
    enabled: enabledInput.checked,
    targetLanguage: targetLanguageSelect.value
  };

  await chrome.storage.sync.set(nextSettings);
}

populateLanguageOptions();
loadSettings();

enabledInput.addEventListener("change", saveSettings);
targetLanguageSelect.addEventListener("change", saveSettings);
