import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseMiddlewareConfig } from "./env";

const warnedMessages = new Set<string>();

function warnOnce(message: string) {
  if (warnedMessages.has(message)) {
    return;
  }

  warnedMessages.add(message);
  console.warn(`[supabase middleware] ${message}`);
}

function passthrough(request: NextRequest) {
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
}

export async function refreshSession(request: NextRequest) {
  const config = getSupabaseMiddlewareConfig();

  if (!config.ok) {
    warnOnce(`${config.reason} Returning NextResponse.next().`);
    return passthrough(request);
  }

  try {
    const response = passthrough(request);
    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          for (const { name, value, options } of cookiesToSet) {
            try {
              request.cookies.set(name, value);
            } catch {
              // Request cookies can be read-only in some edge execution paths.
            }

            try {
              response.cookies.set(name, value, options);
            } catch {
              // Response cookie writes should never abort the request.
            }
          }
        },
      },
    });

    const { error } = await supabase.auth.getUser();

    if (error) {
      warnOnce(`Supabase session refresh returned an auth error: ${error.message}. Returning NextResponse.next().`);
      return passthrough(request);
    }

    return response;
  } catch (error) {
    warnOnce(
      `Supabase middleware failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }. Returning NextResponse.next().`,
    );
    return passthrough(request);
  }
}
