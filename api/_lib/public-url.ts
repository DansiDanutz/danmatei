const CANONICAL_PUBLIC_BASE_URL = "https://www.danmatei.ro";

type HeaderMap = Record<string, string | string[] | undefined>;

function readHeader(
  headers: HeaderMap | undefined,
  key: string
): string | undefined {
  const value = headers?.[key.toLowerCase()] ?? headers?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function cleanOrigin(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function isProductionLike(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  );
}

export function configuredPublicBaseUrl(): string {
  for (const configured of [
    process.env.PUBLIC_BASE_URL,
    process.env.VITE_APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    const origin = configured ? cleanOrigin(configured) : null;
    if (origin) return origin;
  }
  return CANONICAL_PUBLIC_BASE_URL;
}

export function publicBaseUrlFromHeaders(headers?: HeaderMap): string {
  const configuredOrigin = process.env.PUBLIC_BASE_URL
    ? cleanOrigin(process.env.PUBLIC_BASE_URL)
    : null;
  if (configuredOrigin) return configuredOrigin;

  // In production/preview, do not mint links from user-controlled Host headers.
  // Vercel/custom-domain setup should use PUBLIC_BASE_URL; the canonical domain
  // is the safe fallback when that env has not been pasted yet.
  if (isProductionLike()) return CANONICAL_PUBLIC_BASE_URL;

  const rawHost =
    readHeader(headers, "x-forwarded-host") ?? readHeader(headers, "host");
  if (!rawHost) return configuredPublicBaseUrl();

  const host = rawHost.split(",")[0].trim();
  const rawProto = readHeader(headers, "x-forwarded-proto");
  const proto =
    rawProto?.split(",")[0].trim() ||
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");

  return cleanOrigin(`${proto}://${host}`) ?? configuredPublicBaseUrl();
}
