export function isCronPath(pathname: string): boolean {
  return pathname === "/api/cron/supabase-keepalive" || pathname === "/api/cron/pending-inventory";
}
