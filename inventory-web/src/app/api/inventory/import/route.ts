import { NextResponse } from "next/server";

import { getAuthBlockMessage } from "@/lib/auth";
import { importInventoryCsvToSupabase } from "@/lib/supabase/inventory";
import { getServerAuthResolution } from "@/lib/supabase/session";

type ImportRequestBody = {
  csvText?: string;
  sourceName?: string;
};

function isImportAuthorized(role: string) {
  return role === "admin" || role === "manager";
}

export async function POST(request: Request) {
  try {
    const resolution = await getServerAuthResolution();

    if (resolution.state !== "authenticated") {
      return NextResponse.json(
        {
          ok: false,
          message:
            resolution.reason === "inactive"
              ? getAuthBlockMessage("inactive")
              : resolution.reason === "missing-profile"
                ? getAuthBlockMessage("missing-profile")
                : "You must sign in before importing CSV files.",
        },
        { status: resolution.state === "missing-session" ? 401 : 403 },
      );
    }

    if (!isImportAuthorized(resolution.context.profile.role)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Only admins and managers can import CSV files.",
        },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as ImportRequestBody;
    const csvText = body.csvText?.trim() ?? "";

    if (!csvText) {
      return NextResponse.json(
        {
          ok: false,
          message: "Paste a CSV file or text before importing.",
        },
        { status: 400 },
      );
    }

    const summary = await importInventoryCsvToSupabase(
      resolution.context.supabase,
      csvText,
      resolution.context.userId,
      body.sourceName,
    );

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error) {
    console.error("CSV import failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to import CSV into Supabase.",
      },
      { status: 500 },
    );
  }
}

