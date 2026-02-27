const translationCache = new Map<string, string>();
const vttCache = new Map<string, VttCue[]>();
const vttInFlight = new Map<string, Promise<VttCue[]>>();

const PREFETCH_WINDOW = 5;
const TRANSLATION_CACHE_LIMIT = 2000;
const VTT_CACHE_LIMIT = 5;
const TERM_CANDIDATE_PATTERN = /\b[\w./-]+\b/g;
const BACKTICK_PATTERN = /`[^`]+`/g;
const AUTO_PROTECT_SCORE_THRESHOLD = 2;
const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  targetLanguage: 'ko',
  preserveTerms: [],
};
let settingsCache: Settings = { ...DEFAULT_SETTINGS };

type VttCue = {
  start: number;
  end: number;
  text: string;
};

type ProtectedTerm = {
  token: string;
  term: string;
};

type ProtectedRange = {
  start: number;
  end: number;
  text: string;
};

function normalizePreserveTerms(raw: unknown) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const deduped = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') {
      continue;
    }
    const term = value.trim();
    if (!term) {
      continue;
    }
    deduped.add(term);
  }

  return [...deduped];
}

function preserveTermSignature(terms: string[]) {
  return terms
    .map((term) => term.toLowerCase())
    .sort()
    .join('||');
}

async function refreshSettingsCache() {
  const next = (await chrome.storage.sync.get(DEFAULT_SETTINGS)) as Settings;
  const normalized: Settings = {
    enabled: Boolean(next.enabled),
    targetLanguage: next.targetLanguage ?? DEFAULT_SETTINGS.targetLanguage,
    preserveTerms: normalizePreserveTerms(next.preserveTerms),
  };

  if (
    preserveTermSignature(normalized.preserveTerms) !==
    preserveTermSignature(settingsCache.preserveTerms)
  ) {
    translationCache.clear();
  }

  settingsCache = normalized;
}

function isAsciiWordChar(char: string) {
  return /[A-Za-z0-9_]/.test(char);
}

function isBoundarySafe(text: string, start: number, end: number) {
  const left = text[start - 1] ?? '';
  const right = text[end] ?? '';
  if (left && isAsciiWordChar(left)) {
    return false;
  }
  if (right && isAsciiWordChar(right)) {
    return false;
  }
  return true;
}

function isSentenceStartToken(text: string, start: number) {
  let index = start - 1;
  while (index >= 0 && /\s/.test(text[index])) {
    index -= 1;
  }
  if (index < 0) {
    return true;
  }
  return /[.!?:]/.test(text[index]);
}

function scoreTechnicalToken(token: string, sourceText: string, start: number) {
  let score = 0;

  const hasUpper = /[A-Z]/.test(token);
  const hasLower = /[a-z]/.test(token);
  const hasDigit = /\d/.test(token);
  const hasSeparator = /[._/]/.test(token);
  const hasHyphen = /-/.test(token);
  const isUpperAcronym = /^[A-Z0-9]{2,}(?:[./-][A-Z0-9]+)*$/.test(token);
  const isCamelLike = /[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*/.test(token);
  const isPlainWord = /^[a-z]+(?:-[a-z]+)*$/.test(token);
  const isTitleCase = /^[A-Z][a-z]{3,}$/.test(token);
  const isAcronymBrand = /^[A-Z]{2,}[a-z]+(?:[A-Z][a-z0-9]+)*$/.test(token);
  const sentenceStart = isSentenceStartToken(sourceText, start);

  if (isUpperAcronym) {
    score += 2;
  }
  if (isCamelLike) {
    score += 2;
  }
  if (isAcronymBrand) {
    score += 2;
  }
  if (isTitleCase && !sentenceStart) {
    score += 1;
  }
  if (hasDigit) {
    score += 1;
  }
  if (hasSeparator) {
    score += 1;
  }
  if (hasHyphen && (hasUpper || hasDigit)) {
    score += 1;
  }
  if (/^v\d+(?:\.\d+){1,}$/i.test(token)) {
    score += 2;
  }
  if (isPlainWord && !hasUpper && !hasDigit) {
    score -= 2;
  }
  if (token.length <= 2 && !isUpperAcronym) {
    score -= 1;
  }
  if (/^\d+(?:\.\d+)?$/.test(token)) {
    score -= 2;
  }
  if (hasUpper && hasLower) {
    score += 1;
  }

  return score;
}

function collectProtectedRanges(text: string, preserveTerms: string[]) {
  const ranges: ProtectedRange[] = [];

  for (const term of preserveTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(escaped, 'gi');
    let match = matcher.exec(text);
    while (match) {
      const start = match.index;
      const matchedText = match[0] ?? '';
      const end = start + matchedText.length;
      if (matchedText && isBoundarySafe(text, start, end)) {
        ranges.push({ start, end, text: matchedText });
      }
      match = matcher.exec(text);
    }
  }

  BACKTICK_PATTERN.lastIndex = 0;
  let snippetMatch = BACKTICK_PATTERN.exec(text);
  while (snippetMatch) {
    const snippet = snippetMatch[0] ?? '';
    const start = snippetMatch.index;
    const end = start + snippet.length;
    if (snippet && end > start) {
      ranges.push({ start, end, text: snippet });
    }
    snippetMatch = BACKTICK_PATTERN.exec(text);
  }

  TERM_CANDIDATE_PATTERN.lastIndex = 0;
  let tokenMatch = TERM_CANDIDATE_PATTERN.exec(text);
  while (tokenMatch) {
    const token = tokenMatch[0] ?? '';
    const start = tokenMatch.index;
    const end = start + token.length;
    if (
      token &&
      isBoundarySafe(text, start, end) &&
      scoreTechnicalToken(token, text, start) >= AUTO_PROTECT_SCORE_THRESHOLD
    ) {
      ranges.push({ start, end, text: token });
    }
    tokenMatch = TERM_CANDIDATE_PATTERN.exec(text);
  }

  ranges.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    return b.end - a.end;
  });

  const selected: ProtectedRange[] = [];
  let cursor = -1;
  for (const range of ranges) {
    if (range.start < cursor) {
      continue;
    }
    selected.push(range);
    cursor = range.end;
  }

  return selected;
}

function protectTechnicalTerms(text: string, preserveTerms: string[]) {
  const ranges = collectProtectedRanges(text, preserveTerms);
  if (ranges.length === 0) {
    return { protectedText: text, terms: [] as ProtectedTerm[] };
  }

  let cursor = 0;
  let index = 0;
  const terms: ProtectedTerm[] = [];
  const chunks: string[] = [];

  for (const range of ranges) {
    chunks.push(text.slice(cursor, range.start));
    const token = `__UDT_TERM_${index}__`;
    chunks.push(token);
    terms.push({ token, term: range.text });
    cursor = range.end;
    index += 1;
  }

  chunks.push(text.slice(cursor));
  return { protectedText: chunks.join(''), terms };
}

function restoreProtectedTerms(text: string, terms: ProtectedTerm[]) {
  let restored = text;
  for (const { token, term } of terms) {
    restored = restored.split(token).join(term);
  }
  return restored;
}

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
  const { protectedText, terms } = protectTechnicalTerms(
    input,
    settingsCache.preserveTerms,
  );
  endpoint.searchParams.set('q', protectedText);

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Translation request failed: ${response.status}`);
  }

  const payload = (await response.json()) as unknown[][][];
  const translatedRaw = (payload?.[0] ?? [])
    .map((segment) => (Array.isArray(segment) ? (segment?.[0] ?? '') : ''))
    .join('')
    .trim();
  const translated = restoreProtectedTerms(translatedRaw, terms);

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

void refreshSettingsCache();
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') {
    return;
  }

  if (changes.enabled || changes.targetLanguage || changes.preserveTerms) {
    void refreshSettingsCache();
  }
});

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
