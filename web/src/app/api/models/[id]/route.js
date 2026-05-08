import sql from "@/app/api/utils/sql";
import { logActivity } from "@/app/api/utils/logs";

export async function PATCH(request, { params }) {
  const { id } = params;
  const { name, manufacturer } = await request.json();
  const [before] = await sql`SELECT * FROM models WHERE id = ${id}`;

  // If model name changes, we need to update parts that reference this name
  // Requirement says parts reference models from the list.
  // If we rename a model, we should update the parts' compatible_models array.

  await sql.transaction(async (txn) => {
    const [after] = await txn`
      UPDATE models 
      SET name = ${name}, 
          manufacturer = ${manufacturer || null},
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ${id} 
      RETURNING *
    `;

    // Update parts that have the old model name in their JSONB array
    await txn`
      UPDATE parts 
      SET compatible_models = (
        SELECT jsonb_agg(
          CASE 
            WHEN val::text = ${JSON.stringify(before.name)} THEN ${JSON.stringify(name)}::jsonb
            ELSE val
          END
        )
        FROM jsonb_array_elements(compatible_models) val
      )
      WHERE compatible_models @> ${JSON.stringify([before.name])}::jsonb
    `;

    await logActivity({
      actionType: "edited",
      entityType: "model",
      entityId: id,
      displayName: `${after.manufacturer || "Unknown"} ${after.name}`,
      beforeValue: before,
      afterValue: after,
    });

    return Response.json(after);
  });
}

export async function DELETE(request, { params }) {
  const { id } = params;
  const [model] = await sql`SELECT * FROM models WHERE id = ${id}`;

  await sql.transaction(async (txn) => {
    // Remove model from list
    await txn`DELETE FROM models WHERE id = ${id}`;

    // Requirement: "C5030 must no longer appear as an available option for current or future parts"
    // "either automatically remove that compatibility or mark the part for attention"
    // We will remove it from the array and re-check flagging.

    await txn`
      UPDATE parts 
      SET compatible_models = compatible_models - ${model.name}
      WHERE compatible_models @> ${JSON.stringify([model.name])}::jsonb
    `;

    // Mark parts for attention if they now have 0 compatible models
    await txn`
      UPDATE parts 
      SET flagged = TRUE 
      WHERE jsonb_array_length(compatible_models) = 0 AND flagged = FALSE
    `;

    await logActivity({
      actionType: "removed",
      entityType: "model",
      entityId: id,
      displayName: model.name,
      beforeValue: model,
    });
  });

  return new Response(null, { status: 204 });
}
