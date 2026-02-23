const translationCache = new Map();

async function translateText(text, targetLanguage) {
  const input = text.trim();
  if (!input) {
    return "";
  }

  const cacheKey = `${targetLanguage}::${input}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
  endpoint.searchParams.set("client", "gtx");
  endpoint.searchParams.set("sl", "auto");
  endpoint.searchParams.set("tl", targetLanguage);
  endpoint.searchParams.set("dt", "t");
  endpoint.searchParams.set("q", input);

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Translation request failed: ${response.status}`);
  }

  const payload = await response.json();
  const translated = (payload?.[0] ?? [])
    .map((segment) => segment?.[0] ?? "")
    .join("")
    .trim();

  translationCache.set(cacheKey, translated);
  return translated;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "TRANSLATE_TEXT") {
    return false;
  }

  translateText(message.text ?? "", message.targetLanguage ?? "ko")
    .then((translatedText) => {
      sendResponse({ ok: true, translatedText });
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});
