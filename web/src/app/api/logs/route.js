import sql from "@/app/api/utils/sql";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const actionType = searchParams.get("actionType");
  const search = searchParams.get("search");

  let query = `SELECT * FROM inventory_logs WHERE 1=1`;
  const params = [];
  let count = 1;

  if (startDate) {
    query += ` AND timestamp >= $${count}`;
    params.push(startDate);
    count++;
  }
  if (endDate) {
    query += ` AND timestamp <= $${count}`;
    params.push(endDate);
    count++;
  }
  if (actionType) {
    query += ` AND action_type = $${count}`;
    params.push(actionType);
    count++;
  }
  if (search) {
    query += ` AND (display_name ILIKE $${count} OR details ILIKE $${count})`;
    params.push(`%${search}%`);
    count++;
  }

  query += ` ORDER BY timestamp DESC LIMIT 500`;

  const logs = await sql(query, params);
  return Response.json(logs);
}
