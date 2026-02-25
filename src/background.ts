const translationCache = new Map<string, string>();
const vttCache = new Map<string, VttCue[]>();
const vttInFlight = new Map<string, Promise<VttCue[]>>();

const PREFETCH_WINDOW = 5;
const TRANSLATION_CACHE_LIMIT = 2000;
const VTT_CACHE_LIMIT = 5;

type VttCue = {
  start: number;
  end: number;
  text: string;
};

async function translateText(
  text: string,
  targetLanguage: string,
): Promise<string> {
  const input = text.trim();
  if (!input) {
    return '';
  }

  const cacheKey = `${targetLanguage}::${input}`;
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const endpoint = new URL(
    'https://translate.googleapis.com/translate_a/single',
  );
  endpoint.searchParams.set('client', 'gtx');
  endpoint.searchParams.set('sl', 'auto');
  endpoint.searchParams.set('tl', targetLanguage);
  endpoint.searchParams.set('dt', 't');
  endpoint.searchParams.set('q', input);

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Translation request failed: ${response.status}`);
  }

  const payload = (await response.json()) as unknown[][][];
  const translated = (payload?.[0] ?? [])
    .map((segment) => (Array.isArray(segment) ? (segment?.[0] ?? '') : ''))
    .join('')
    .trim();

  setLruCache(translationCache, cacheKey, translated, TRANSLATION_CACHE_LIMIT);
  return translated;
}

function parseTimestamp(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 0;
  }

  const parts = trimmed.split(':');
  let hours = 0;
  let minutes = 0;
  let secondsPart = '';

  if (parts.length === 3) {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
    secondsPart = parts[2];
  } else if (parts.length === 2) {
    minutes = Number(parts[0]);
    secondsPart = parts[1];
  } else {
    secondsPart = parts[0];
  }

  const [secondsRaw, millisRaw] = secondsPart.split('.');
  const seconds = Number(secondsRaw);
  const millis = Number((millisRaw ?? '0').padEnd(3, '0').slice(0, 3));

  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function sanitizeCueText(text: string) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseVtt(text: string): VttCue[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const cues: VttCue[] = [];
  let index = 0;

  while (index < lines.length) {
    let line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith('WEBVTT')) {
      index += 1;
      continue;
    }

    if (!line.includes('-->') && lines[index + 1]?.includes('-->')) {
      index += 1;
      line = lines[index].trim();
    }

    if (!line.includes('-->')) {
      index += 1;
      continue;
    }

    const [startRaw, endRawWithSettings] = line
      .split('-->')
      .map((part) => part.trim());
    const endRaw = endRawWithSettings.split(' ')[0].trim();
    const start = parseTimestamp(startRaw);
    const end = parseTimestamp(endRaw);

    index += 1;
    const textLines: string[] = [];
    while (index < lines.length && lines[index].trim() !== '') {
      textLines.push(lines[index]);
      index += 1;
    }

    const cueText = sanitizeCueText(textLines.join(' '));
    if (cueText) {
      cues.push({ start, end, text: cueText });
    }

    index += 1;
  }

  return cues;
}

function setLruCache<K, V>(cache: Map<K, V>, key: K, value: V, limit: number) {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);
  if (cache.size <= limit) {
    return;
  }
  const oldestKey = cache.keys().next().value;
  if (oldestKey === undefined) {
    return;
  }
  cache.delete(oldestKey);
}

function findCueIndex(time: number, cues: VttCue[]) {
  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cue = cues[mid];
    if (time < cue.start) {
      high = mid - 1;
    } else if (time > cue.end) {
      low = mid + 1;
    } else {
      return mid;
    }
  }

  return Math.min(low, cues.length);
}

async function loadVttCues(url: string): Promise<VttCue[]> {
  const cached = vttCache.get(url);
  if (cached) {
    return cached;
  }

  const pending = vttInFlight.get(url);
  if (pending) {
    return pending;
  }

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`VTT request failed: ${response.status}`);
      }
      const text = await response.text();
      const cues = parseVtt(text);
      setLruCache(vttCache, url, cues, VTT_CACHE_LIMIT);
      return cues;
    })
    .finally(() => {
      vttInFlight.delete(url);
    });

  vttInFlight.set(url, request);
  return request;
}

async function prefetchTranslations(
  url: string,
  targetLanguage: string,
  currentTime: number,
) {
  const cues = await loadVttCues(url);
  if (cues.length === 0) {
    return [];
  }

  const startIndex = findCueIndex(currentTime, cues);
  const endIndex = Math.min(startIndex + PREFETCH_WINDOW, cues.length);
  const texts: string[] = [];
  const spritePattern = /\.(png|jpe?g|webp)(#|$)|xywh=/i;

  for (let i = startIndex; i < endIndex; i += 1) {
    const text = cues[i]?.text ?? '';
    if (!text) {
      continue;
    }
    if (spritePattern.test(text)) {
      continue;
    }
    texts.push(text);
  }

  if (texts.length === 0) {
    return [];
  }

  const translated = await Promise.all(
    texts.map(async (text) => ({
      text,
      translatedText: await translateText(text, targetLanguage),
    })),
  );

  return translated;
}

chrome.runtime.onMessage.addListener(
  (message: TranslateRequest | PrefetchVttRequest, _sender, sendResponse) => {
    if (message?.type === 'TRANSLATE_TEXT') {
      translateText(message.text ?? '', message.targetLanguage ?? 'ko')
        .then((translatedText) => {
          const response: TranslateResponse = { ok: true, translatedText };
          sendResponse(response);
        })
        .catch((error: Error) => {
          const response: TranslateResponse = {
            ok: false,
            error: error.message,
          };
          sendResponse(response);
        });

      return true;
    }

    if (message?.type === 'PREFETCH_VTT') {
      const url = message.url ?? '';
      const targetLanguage = message.targetLanguage ?? 'ko';
      const currentTime = message.currentTime ?? 0;
      prefetchTranslations(url, targetLanguage, currentTime)
        .then((items) => {
          const reply: PrefetchVttResponse = { ok: true, items };
          sendResponse(reply);
        })
        .catch((error: Error) => {
          const reply: PrefetchVttResponse = {
            ok: false,
            error: error.message,
          };
          sendResponse(reply);
        });

      return true;
    }

    return false;
  },
);
