/**
 * Shared cron authorization — fail-closed.
 *
 * Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on scheduled
 * invocations. We refuse to run in production/preview when CRON_SECRET is unset
 * so an unconfigured deploy can't be triggered by anyone (LLM-credit drain,
 * push/DB spam, money mutations). In local dev (no prod/preview env) we warn and
 * allow, so the endpoints stay testable.
 *
 * Returns true if the caller is authorized to proceed. When it returns false it
 * has already written the response (401/503) — the handler must just return.
 */
type CronReq = { headers?: Record<string, string | string[] | undefined> };
type CronRes = { status: (n: number) => { json: (b: unknown) => unknown } };

function readAuth(req: CronReq): string {
  const v = req.headers?.["authorization"] ?? req.headers?.["Authorization"];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function requireCron(req: CronReq, res: CronRes, label = "cron"): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production" ||
      process.env.VERCEL_ENV === "preview"
    ) {
      res.status(503).json({ error: "cron_secret_unset" });
      return false;
    }
    console.warn(`[${label}] CRON_SECRET unset — allowing in dev only`);
    return true;
  }
  if (readAuth(req) !== `Bearer ${expected}`) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}
