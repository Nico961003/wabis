import { db } from "../db/database.js";

export function recordAudit(
  productId: number | null,
  userId: number | undefined,
  action: string,
  details: unknown = {},
): void {
  db.prepare("INSERT INTO audit_log (product_id, user_id, action, details) VALUES (?, ?, ?, ?)").run(
    productId,
    userId ?? null,
    action,
    JSON.stringify(details),
  );
}
