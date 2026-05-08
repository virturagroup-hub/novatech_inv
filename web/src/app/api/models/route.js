import sql from "@/app/api/utils/sql";
import { logActivity } from "@/app/api/utils/logs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const manufacturer = searchParams.get("manufacturer") || "";

  let query = `SELECT * FROM models WHERE 1=1`;
  const params = [];
  let paramIndex = 1;

  if (search) {
    query += ` AND LOWER(name) LIKE LOWER($${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (manufacturer) {
    query += ` AND LOWER(manufacturer) = LOWER($${paramIndex})`;
    params.push(manufacturer);
    paramIndex++;
  }

  query += ` ORDER BY manufacturer ASC NULLS LAST, name ASC`;

  const models = await sql(query, params);
  return Response.json(models);
}

export async function POST(request) {
  const { name, manufacturer } = await request.json();

  // Normalize empty manufacturer to null
  const mfr =
    manufacturer && manufacturer.trim() !== "" ? manufacturer.trim() : null;

  // Check for duplicate model - build query dynamically
  let duplicateQuery;
  let duplicateParams;

  if (mfr) {
    duplicateQuery = `
      SELECT * FROM models 
      WHERE LOWER(name) = LOWER($1)
      AND LOWER(manufacturer) = LOWER($2)
    `;
    duplicateParams = [name, mfr];
  } else {
    duplicateQuery = `
      SELECT * FROM models 
      WHERE LOWER(name) = LOWER($1)
      AND manufacturer IS NULL
    `;
    duplicateParams = [name];
  }

  const existing = await sql(duplicateQuery, duplicateParams);

  if (existing.length > 0) {
    return Response.json(
      {
        error: "duplicate",
        message: "A model with this name and manufacturer already exists",
        existing: existing[0],
      },
      { status: 409 },
    );
  }

  const [model] = await sql`
    INSERT INTO models (name, manufacturer) 
    VALUES (${name}, ${mfr}) 
    RETURNING *
  `;

  await logActivity({
    actionType: "added",
    entityType: "model",
    entityId: model.id,
    displayName: `${mfr || "Unknown"} ${model.name}`,
    afterValue: model,
  });

  return Response.json(model);
}
