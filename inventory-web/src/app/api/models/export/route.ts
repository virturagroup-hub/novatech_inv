import { NextResponse } from "next/server";

import { serializeModelCsv, type ModelCsvExportRow } from "@/lib/model-csv";
import { getServerAuthResolution } from "@/lib/supabase/session";

const PAGE_SIZE = 1000;

type ExportModelRow = {
  manufacturer: string | null;
  model_name: string | null;
  series: string | null;
  notes: string | null;
};

function exportFilename() {
  return `models-export-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET() {
  const resolution = await getServerAuthResolution();
  if (resolution.state !== "authenticated") {
    return NextResponse.json({ ok: false, message: "You must be signed in." }, { status: 401 });
  }

  if (resolution.context.profile.role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "Only admins can export model CSV files." },
      { status: 403 },
    );
  }

  try {
    const rows: ExportModelRow[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await resolution.context.supabase
        .from("models")
        .select("manufacturer, model_name, series, notes")
        .eq("status", "active")
        .is("archived_at", null)
        .is("deleted_at", null)
        .order("manufacturer", { ascending: true })
        .order("model_name", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      rows.push(...((data ?? []) as ExportModelRow[]));
      if (!data || data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No active models are available to export." },
        { status: 404 },
      );
    }

    const exportRows: ModelCsvExportRow[] = rows.map((row) => ({
      manufacturer: row.manufacturer?.trim() ?? "",
      model_name: row.model_name?.trim() ?? "",
      series_family: row.series?.trim() ?? "",
      notes: row.notes?.trim() ?? "",
    }));
    const csv = `\uFEFF${serializeModelCsv(exportRows)}`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${exportFilename()}"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Model-Count": String(exportRows.length),
      },
    });
  } catch (error) {
    console.error("Model CSV export failed", error);
    return NextResponse.json(
      { ok: false, message: "Could not export models right now." },
      { status: 500 },
    );
  }
}
