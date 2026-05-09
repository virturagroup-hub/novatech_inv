import { NextResponse } from "next/server";

import { getServerAuthResolution } from "@/lib/supabase/session";
import { fetchInventorySnapshot } from "@/lib/supabase/inventory";

export async function GET() {
  try {
    const resolution = await getServerAuthResolution();

    if (resolution.state !== "authenticated") {
      return NextResponse.json(
        {
          ok: false,
          message:
            resolution.reason === "inactive"
              ? "This account is inactive. Contact an admin."
              : resolution.reason === "missing-profile"
                ? "Your account exists, but no app profile was found. Contact an admin."
                : "You must sign in to load inventory data.",
        },
        { status: resolution.state === "missing-session" ? 401 : 403 },
      );
    }

    const snapshot = await fetchInventorySnapshot(resolution.context.supabase);

    return NextResponse.json({
      ok: true,
      dataSource: "supabase",
      data: snapshot,
    });
  } catch (error) {
    console.error("Failed to load inventory snapshot:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Failed to load inventory data from Supabase.",
      },
      { status: 500 },
    );
  }
}

