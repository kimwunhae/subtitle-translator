/// <reference types="vite/client" />

declare global {
  type Settings = {
    enabled: boolean;
    targetLanguage: string;
    preserveTerms: string[];
  };

  type LanguageOption = {
    code: string;
    label: string;
  };

  type TranslateRequest = {
    type: 'TRANSLATE_TEXT';
    text?: string;
    targetLanguage?: string;
  };

  type TranslateResponse =
    | { ok: true; translatedText: string }
    | { ok: false; error: string };

  type PrefetchVttRequest = {
    type: 'PREFETCH_VTT';
    url?: string;
    targetLanguage?: string;
    currentTime?: number;
  };

  type PrefetchVttResponse =
    | { ok: true; items: { text: string; translatedText: string }[] }
    | { ok: false; error: string };

  type GetCurrentVttUrlRequest = {
    type: 'GET_CURRENT_VTT_URL';
  };

  type GetCurrentVttUrlResponse =
    | { ok: true; url: string }
    | { ok: false; error: string };

  type DownloadVttRequest = {
    type: 'DOWNLOAD_VTT';
  };

  type DownloadVttResponse =
    | { ok: true; downloadId: number }
    | { ok: false; error: string };
}

export {};
