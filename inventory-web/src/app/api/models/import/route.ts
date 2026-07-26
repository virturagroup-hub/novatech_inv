import { NextResponse } from "next/server";

import { parseModelCsv } from "@/lib/model-csv";
import { getServerAuthResolution } from "@/lib/supabase/session";
import type { ModelRow } from "@/lib/supabase/types";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function modelKey(manufacturer: string, modelName: string) {
  return `${normalize(manufacturer)}::${normalize(modelName)}`;
}

export async function POST(request: Request) {
  const resolution = await getServerAuthResolution();
  if (resolution.state !== "authenticated") {
    return NextResponse.json({ ok: false, message: "You must be signed in." }, { status: 401 });
  }

  if (resolution.context.profile.role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "Only admins can import model CSV files." },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as { csvText?: string };
    if (!body.csvText?.trim()) {
      return NextResponse.json({ ok: false, message: "CSV content is required." }, { status: 400 });
    }

    const preview = parseModelCsv(body.csvText);
    const { data: existingRows, error: existingError } = await resolution.context.supabase
      .from("models")
      .select("id, manufacturer, model_name, series, notes, status");

    if (existingError) throw existingError;

    const existingByKey = new Map(
      ((existingRows ?? []) as ModelRow[]).map((model) => [
        modelKey(model.manufacturer, model.model_name),
        model,
      ]),
    );
    const results = preview.rows.map((row) => ({
      rowIndex: row.rowIndex,
      modelName: row.modelName,
      status: "skipped" as "created" | "updated" | "skipped",
      errors: [...row.errors],
    }));
    let modelsCreated = 0;
    let modelsUpdated = 0;

    for (const [index, row] of preview.rows.entries()) {
      const result = results[index];
      if (row.errors.length > 0) continue;

      const manufacturer = row.manufacturer.trim() || "Unknown";
      const key = modelKey(manufacturer, row.modelName);
      const existing = existingByKey.get(key);

      if (existing) {
        const updates: Record<string, string> = {};
        if (!existing.series.trim() && row.series.trim()) updates.series = row.series.trim();
        if (!existing.notes?.trim() && row.notes.trim()) updates.notes = row.notes.trim();

        if (Object.keys(updates).length > 0) {
          const { error } = await resolution.context.supabase
            .from("models")
            .update(updates)
            .eq("id", existing.id);
          if (error) throw error;
          modelsUpdated += 1;
          result.status = "updated";
        } else {
          result.status = "skipped";
        }
        continue;
      }

      const { data: inserted, error } = await resolution.context.supabase
        .from("models")
        .insert({
          manufacturer,
          model_name: row.modelName.trim(),
          series: row.series.trim(),
          status: "active",
          notes: row.notes.trim() || null,
        })
        .select("id, manufacturer, model_name, series, notes, status")
        .single();

      if (error) throw error;
      if (inserted) {
        existingByKey.set(key, inserted as ModelRow);
      }
      modelsCreated += 1;
      result.status = "created";
    }

    return NextResponse.json({
      ok: true,
      totalRows: preview.totalRows,
      readyRows: preview.readyRows,
      invalidRows: preview.invalidRows,
      duplicateRows: preview.duplicateRows,
      modelsCreated,
      modelsUpdated,
      rowResults: results,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Model CSV import failed." },
      { status: 500 },
    );
  }
}

