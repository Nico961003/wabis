import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../db/database.js";
import { config } from "../config.js";

export async function cleanExpiredProducts(): Promise<number> {
  const products = db
    .prepare("SELECT id FROM products WHERE deleted_at IS NOT NULL AND delete_after <= CURRENT_TIMESTAMP")
    .all() as Array<{ id: number }>;
  for (const product of products) {
    const files = db
      .prepare("SELECT file_name, thumbnail_file_name FROM product_images WHERE product_id = ?")
      .all(product.id) as Array<{ file_name: string; thumbnail_file_name: string }>;
    await Promise.all(
      files.flatMap((file) => [
        fs.unlink(path.join(config.uploadDir, file.file_name)).catch(() => undefined),
        file.thumbnail_file_name
          ? fs.unlink(path.join(config.uploadDir, file.thumbnail_file_name)).catch(() => undefined)
          : Promise.resolve(),
      ]),
    );
    db.prepare("DELETE FROM products WHERE id = ?").run(product.id);
  }
  return products.length;
}
