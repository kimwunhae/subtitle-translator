const translationCache = new Map<string, string>();

async function translateText(text: string, targetLanguage: string): Promise<string> {
  const input = text.trim();
  if (!input) {
    return "";
  }

  const cacheKey = `${targetLanguage}::${input}`;
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return cached;
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

  const payload = (await response.json()) as unknown[][][];
  const translated = (payload?.[0] ?? [])
    .map((segment) => (Array.isArray(segment) ? segment?.[0] ?? "" : ""))
    .join("")
    .trim();

  translationCache.set(cacheKey, translated);
  return translated;
}

chrome.runtime.onMessage.addListener(
  (message: TranslateRequest, _sender, sendResponse) => {
    if (message?.type !== "TRANSLATE_TEXT") {
      return false;
    }

    translateText(message.text ?? "", message.targetLanguage ?? "ko")
      .then((translatedText) => {
        const response: TranslateResponse = { ok: true, translatedText };
        sendResponse(response);
      })
      .catch((error: Error) => {
        const response: TranslateResponse = {
          ok: false,
          error: error.message
        };
        sendResponse(response);
      });

    return true;
  }
);
