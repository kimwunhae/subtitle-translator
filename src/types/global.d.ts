/// <reference types="vite/client" />

declare global {
  type Settings = {
    enabled: boolean;
    targetLanguage: string;
  };

  type LanguageOption = {
    code: string;
    label: string;
  };

  type TranslateRequest = {
    type: "TRANSLATE_TEXT";
    text?: string;
    targetLanguage?: string;
  };

  type TranslateResponse =
    | { ok: true; translatedText: string }
    | { ok: false; error: string };
}

export {};
