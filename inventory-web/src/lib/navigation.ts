const INTERNAL_PATH_ORIGIN = "https://green-nventory.internal";

export function sanitizeInternalPath(value: string | null | undefined, fallback = "/") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, INTERNAL_PATH_ORIGIN);

    if (parsed.origin !== INTERNAL_PATH_ORIGIN) {
      return fallback;
    }

    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return normalized.startsWith("/") ? normalized : fallback;
  } catch {
    return fallback;
  }
}

export function getAppOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");

  if (configured) {
    return configured;
  }

  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  return "";
}

export function buildAbsoluteAppUrl(path: string) {
  const safePath = sanitizeInternalPath(path);
  const origin = getAppOrigin();

  if (!origin) {
    return safePath;
  }

  try {
    return new URL(safePath, origin).toString();
  } catch {
    return safePath;
  }
}

export function buildLoginPath(options?: { reason?: string | null; nextPath?: string | null }) {
  const params = new URLSearchParams();
  const nextPath = sanitizeInternalPath(options?.nextPath);

  if (options?.reason) {
    params.set("reason", options.reason);
  }

  if (nextPath !== "/") {
    params.set("next", nextPath);
  }

  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

export function buildChangePasswordPath(nextPath?: string | null) {
  const safeNextPath = sanitizeInternalPath(nextPath);

  if (safeNextPath === "/") {
    return "/change-password";
  }

  return `/change-password?next=${encodeURIComponent(safeNextPath)}`;
}

export function buildAccessDeniedPath(options?: { nextPath?: string | null; reason?: string | null }) {
  const params = new URLSearchParams();
  const nextPath = sanitizeInternalPath(options?.nextPath);

  if (options?.reason) {
    params.set("reason", options.reason);
  }

  if (nextPath !== "/") {
    params.set("next", nextPath);
  }

  const query = params.toString();
  return query ? `/access-denied?${query}` : "/access-denied";
}
