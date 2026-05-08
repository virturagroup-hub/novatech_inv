import type { NextRequest } from "next/server";

import { refreshSession } from "./src/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest(?:\\.webmanifest)?|icon(?:/.*)?|apple-icon(?:/.*)?|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|css|js|mjs|map)$).*)",
  ],
};

