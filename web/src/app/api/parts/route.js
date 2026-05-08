import sql from "@/app/api/utils/sql";
import { logActivity } from "@/app/api/utils/logs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const binId = searchParams.get("binId");
  const flagged = searchParams.get("flagged");
  const model = searchParams.get("model");
  const manufacturer = searchParams.get("manufacturer");

  let query = `
    SELECT p.*, b.name as bin_name 
    FROM parts p 
    LEFT JOIN bins b ON p.bin_id = b.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (search) {
    query += ` AND (p.part_number ILIKE $${paramCount} OR p.part_name ILIKE $${paramCount})`;
    params.push(`%${search}%`);
    paramCount++;
  }

  if (binId) {
    query += ` AND p.bin_id = $${paramCount}`;
    params.push(parseInt(binId));
    paramCount++;
  }

  if (flagged === "true") {
    query += ` AND p.flagged = TRUE`;
  }

  if (model) {
    query += ` AND p.compatible_models @> $${paramCount}::jsonb`;
    params.push(JSON.stringify([model]));
    paramCount++;
  }

  if (manufacturer) {
    // Filter parts that have at least one compatible model from this manufacturer
    query += ` AND EXISTS (
      SELECT 1 FROM models m 
      WHERE LOWER(m.manufacturer) = LOWER($${paramCount})
      AND p.compatible_models @> jsonb_build_array(m.name)::jsonb
    )`;
    params.push(manufacturer);
    paramCount++;
  }

  query += ` ORDER BY p.created_at DESC`;

  const results = await sql(query, params);

  // Format parts with bin info
  const parts = results.map((part) => ({
    ...part,
    bin: part.bin_name ? { name: part.bin_name } : null,
  }));

  return Response.json({ parts });
}

export async function POST(request) {
  const body = await request.json();
  const {
    part_number,
    part_name,
    compatible_models,
    in_date,
    bin_id,
    quantity,
    notes,
    is_universal,
  } = body;

  // Check for duplicate part number
  const existing = await sql`
    SELECT * FROM parts WHERE LOWER(part_number) = LOWER(${part_number})
  `;

  if (existing.length > 0) {
    return Response.json(
      {
        error: "duplicate",
        message: "A part with this part number already exists",
        existing: existing[0],
      },
      { status: 409 },
    );
  }

  // Flag if no compatible models selected AND not marked as universal
  const flagged =
    !is_universal && (!compatible_models || compatible_models.length === 0);

  // Handle empty/null bin_id properly
  const binIdValue = bin_id && bin_id !== "" ? parseInt(bin_id) : null;

  // Ensure quantity is a number
  const quantityValue =
    quantity !== undefined && quantity !== null ? parseInt(quantity) : 0;

  const [part] = await sql`
    INSERT INTO parts (part_number, part_name, compatible_models, in_date, bin_id, quantity, notes, flagged, is_universal)
    VALUES (${part_number}, ${part_name}, ${JSON.stringify(compatible_models || [])}, ${in_date}, ${binIdValue}, ${quantityValue}, ${notes || null}, ${flagged}, ${is_universal || false})
    RETURNING *
  `;

  await logActivity({
    actionType: "added",
    entityType: "part",
    entityId: part.id,
    displayName: `${part.part_number} - ${part.part_name}`,
    details:
      quantityValue > 0
        ? `Added ${quantityValue} unit(s) to inventory`
        : undefined,
    afterValue: part,
  });

  return Response.json(part);
}
