import type { NextRequest } from "next/server";

import { refreshSession } from "./src/lib/supabase/middleware";
import { isCronPath } from "./src/lib/cron-paths";

export async function middleware(request: NextRequest) {
  // Cron routes authenticate their own Bearer secret, without a browser session.
  if (isCronPath(request.nextUrl.pathname)) {
    return (await import("next/server")).NextResponse.next();
  }
  return refreshSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest(?:\\.webmanifest)?|icon(?:/.*)?|apple-icon(?:/.*)?|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|css|js|mjs|map)$).*)",
  ],
};

