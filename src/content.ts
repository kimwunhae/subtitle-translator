const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  targetLanguage: "ko"
};

const SUBTITLE_SELECTORS = [
  '[data-purpose="captions-text"]',
  '[class*="captions-text"]',
  '[class*="captions-display"]'
];

let settings: Settings = { ...DEFAULT_SETTINGS };

async function refreshSettings() {
  settings = await chrome.storage.sync.get(DEFAULT_SETTINGS) as Settings;
}

function isInMainCaptionArea(element: HTMLElement) {
  const isCueText =
    element.getAttribute("data-purpose") === "captions-cue-text" ||
    element.className.includes("captions-cue-text");
  return isCueText;
}

function getCaptionCandidates(): HTMLElement[] {
  const nodes: HTMLElement[] = [];

  SUBTITLE_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      if (element.closest(".udemy-dual-subtitle")) {
        return;
      }

      nodes.push(element);
    });
  });

  return [...new Set(nodes)].filter(isInMainCaptionArea);
}

function getPrimaryText(element: HTMLElement) {
  const cloned = element.cloneNode(true) as HTMLElement;
  cloned.querySelectorAll(".udemy-dual-subtitle").forEach((node) => node.remove());
  return cloned.textContent?.trim() ?? "";
}

async function requestTranslation(text: string): Promise<string> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "TRANSLATE_TEXT",
        text,
        targetLanguage: settings.targetLanguage
      },
      (response: TranslateResponse) => {
        if (chrome.runtime.lastError || !response?.ok) {
          resolve("");
          return;
        }

        resolve(response.translatedText ?? "");
      }
    );
  });
}

async function updateDualSubtitle(element: HTMLElement) {
  if (!settings.enabled) {
    element
      .querySelectorAll(".udemy-dual-subtitle")
      .forEach((node) => node.remove());
    return;
  }

  const sourceText = getPrimaryText(element);
  if (!sourceText) {
    return;
  }

  if (
    element.dataset.dualSubtitleSource === sourceText &&
    element.dataset.dualSubtitleLang === settings.targetLanguage
  ) {
    return;
  }

  const translatedText = await requestTranslation(sourceText);
  if (!translatedText) {
    return;
  }

  let translationNode = element.querySelector(":scope > .udemy-dual-subtitle");
  if (!translationNode) {
    translationNode = document.createElement("div");
    translationNode.className = "udemy-dual-subtitle";
    element.appendChild(translationNode);
  }

  translationNode.textContent = translatedText;
  element.dataset.dualSubtitleSource = sourceText;
  element.dataset.dualSubtitleLang = settings.targetLanguage;
}

async function renderAll() {
  const candidates = getCaptionCandidates();
  await Promise.all(candidates.map((element) => updateDualSubtitle(element)));
}

const observer = new MutationObserver(() => {
  renderAll();
});

function setupDevReload() {
  if (!import.meta.env.DEV) {
    return;
  }

  let source: EventSource | null = null;

  const connect = () => {
    source = new EventSource("http://localhost:35729/events");

    source.addEventListener("reload", () => {
      chrome.runtime.reload();
    });

    source.onerror = () => {
      if (source) {
        source.close();
      }
      setTimeout(connect, 1000);
    };
  };

  connect();
}

async function init() {
  await refreshSettings();
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
  renderAll();
  setupDevReload();
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  if (changes.enabled) {
    settings.enabled = changes.enabled.newValue;
  }

  if (changes.targetLanguage) {
    settings.targetLanguage = changes.targetLanguage.newValue;
  }

  renderAll();
});

init();
