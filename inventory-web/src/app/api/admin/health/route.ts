import { NextResponse } from "next/server";

import { buildAdminHealthReport } from "@/lib/admin-health";
import { getServerAuthResolution } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const resolution = await getServerAuthResolution();

  if (resolution.state !== "authenticated") {
    return NextResponse.json(
      { ok: false, message: "Sign in with an admin account to view health status." },
      { status: 401 },
    );
  }

  if (resolution.context.profile.role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "Admin access is required to view health status." },
      { status: 403 },
    );
  }

  const data = await buildAdminHealthReport(resolution.context.supabase);

  return NextResponse.json({ ok: true, data });
}
