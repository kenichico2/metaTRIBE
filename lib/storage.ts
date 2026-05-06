"use client";

const KEY = "auto-excitement.backend-url";

export function loadBackendUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveBackendUrl(url: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, url);
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

export function normalizeBackendUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "http://" + s;
  return s.replace(/\/+$/, "");
}

export function resolveBackendAsset(backend: string, urlOrPath: string): string {
  if (!urlOrPath) return "";
  if (/^(https?:|blob:|data:)/i.test(urlOrPath)) return urlOrPath;
  if (!backend) return urlOrPath;
  if (urlOrPath.startsWith("/")) return backend + urlOrPath;
  return backend + "/" + urlOrPath;
}
