/**
 * Minimal i18n: Hebrew (default, right-to-left) and English.
 *
 * The English text is the translation key, so English needs no dictionary and a missing Hebrew
 * entry falls back to readable English. `src/i18n/i18n.test.js` fails if any t("...") literal used
 * in the app has no Hebrew translation.
 *
 *   t("Log service")                     -> "רישום טיפול"
 *   t("Due {date}", { date })            -> interpolation with {name} placeholders
 *   tp(n, "1 service", "{n} services")   -> singular / plural
 */
import { useSyncExternalStore } from "react";
import he from "./he";

export const LANGUAGES = [
  { code: "he", label: "עברית", dir: "rtl", locale: "he-IL" },
  { code: "en", label: "English", dir: "ltr", locale: "en-GB" },
];
export const DEFAULT_LANGUAGE = "he";
const STORAGE_KEY = "lang";
const BY_CODE = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && BY_CODE[v]) return v;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LANGUAGE;
}

let current = readStored();
const listeners = new Set();

export function getLanguage() {
  return current;
}

export function languageInfo(code = current) {
  return BY_CODE[code] || BY_CODE[DEFAULT_LANGUAGE];
}

export function isRTL(code = current) {
  return languageInfo(code).dir === "rtl";
}

/** BCP-47 locale for Intl number/date formatting. */
export function locale() {
  return languageInfo().locale;
}

/** Mirror the current language onto <html lang dir>. */
export function applyLanguageToDocument() {
  if (typeof document === "undefined") return;
  const info = languageInfo();
  document.documentElement.lang = info.code;
  document.documentElement.dir = info.dir;
}

export function setLanguage(code) {
  if (!BY_CODE[code] || code === current) return;
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  applyLanguageToDocument();
  listeners.forEach((fn) => fn());
}

export function subscribeLanguage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

/** Translate an English source string into the current language. */
export function t(key, vars) {
  const text = current === "he" ? (he[key] ?? key) : key;
  return interpolate(text, vars);
}

/** Singular/plural helper: tp(3, "1 service", "{n} services"). */
export function tp(n, one, other, vars) {
  return t(n === 1 ? one : other, { n, ...vars });
}

/** React hook: re-renders on language change. */
export function useLanguage() {
  const lang = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  return { lang, dir: languageInfo(lang).dir, setLanguage, t, tp };
}
