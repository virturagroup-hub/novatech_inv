export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  return url;
}

export function getSupabasePublishableKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return key;
}

export function getSupabaseAnonKey() {
  return getSupabasePublishableKey();
}

export function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return key;
}

export function hasSupabaseCredentials() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export type SupabaseMiddlewareConfig =
  | {
      ok: true;
      url: string;
      key: string;
      keySource: "publishable" | "anon";
    }
  | {
      ok: false;
      reason: string;
    };

function isLikelySupabaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function isLikelySupabaseKey(value: string) {
  return value.trim().length >= 20 && !/\s/.test(value);
}

export function getSupabaseMiddlewareConfig(): SupabaseMiddlewareConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const key = publishableKey || anonKey;
  const keySource = publishableKey ? "publishable" : anonKey ? "anon" : null;

  if (!url) {
    return {
      ok: false,
      reason: "Missing NEXT_PUBLIC_SUPABASE_URL.",
    };
  }

  if (!keySource) {
    return {
      ok: false,
      reason: "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  if (!isLikelySupabaseUrl(url)) {
    return {
      ok: false,
      reason: "NEXT_PUBLIC_SUPABASE_URL is not a valid Supabase URL.",
    };
  }

  if (!isLikelySupabaseKey(key)) {
    return {
      ok: false,
      reason: "Supabase public key is missing or invalid.",
    };
  }

  return {
    ok: true,
    url,
    key,
    keySource,
  };
}

export function getSupabaseEnvPresence() {
  const config = getSupabaseMiddlewareConfig();

  return {
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    supabasePublishableKeyConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
    ),
    supabaseAnonKeyConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    middlewareReady: config.ok,
    reason: config.ok ? null : config.reason,
  };
}
