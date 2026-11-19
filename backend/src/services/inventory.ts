import { db } from "../db/database.js";
import { deriveProductAvailability } from "./availability.js";

export function recalculateAvailability(productId: number): "available" | "sold_out" {
  const quantities = (
    db.prepare("SELECT quantity FROM inventory WHERE product_id = ?").all(productId) as Array<{ quantity: number }>
  ).map((row) => row.quantity);
  const availability = deriveProductAvailability(quantities);
  db.prepare(
    "UPDATE products SET availability = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
  ).run(availability, productId);
  return availability;
}

export function updateInventory(
  productId: number,
  colorId: number,
  sizeId: number | null,
  quantity: number,
): "available" | "sold_out" {
  return db.transaction(() => {
    const updated =
      sizeId === null
        ? db
            .prepare("UPDATE inventory SET quantity = ? WHERE product_id = ? AND color_id = ? AND size_id IS NULL")
            .run(quantity, productId, colorId)
        : db
            .prepare("UPDATE inventory SET quantity = ? WHERE product_id = ? AND color_id = ? AND size_id = ?")
            .run(quantity, productId, colorId, sizeId);
    if (updated.changes === 0) {
      db.prepare("INSERT INTO inventory (product_id, color_id, size_id, quantity) VALUES (?, ?, ?, ?)").run(
        productId,
        colorId,
        sizeId,
        quantity,
      );
    }
    return recalculateAvailability(productId);
  })();
}
