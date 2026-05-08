import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  hasSupabaseCredentials,
} from "./env";

export async function refreshSession(request: NextRequest) {
  const passthrough = () =>
    NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

  if (!hasSupabaseCredentials()) {
    return passthrough();
  }

  try {
    const response = passthrough();

    const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              request.cookies.set(name, value);
            } catch {
              // Some runtime environments expose a read-only request cookie jar.
            }

            response.cookies.set(name, value, options);
          });
        },
      },
    });

    await supabase.auth.getClaims();

    return response;
  } catch {
    return passthrough();
  }
}
