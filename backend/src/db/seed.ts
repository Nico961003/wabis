import argon2 from "argon2";
import { db, migrate } from "./database.js";
import { config } from "../config.js";

async function seed(): Promise<void> {
  if (!config.adminPassword) {
    throw new Error("ADMIN_PASSWORD debe definirse para ejecutar el seed.");
  }
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get("Admin") as { id: number } | undefined;
  if (!existing) {
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(
      "Admin",
      await argon2.hash(config.adminPassword),
    );
  }

  const count = db.prepare("SELECT COUNT(*) AS count FROM products WHERE deleted_at IS NULL").get() as {
    count: number;
  };
  if (count.count > 0) return;

  const createCategory = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
  const createProduct = db.prepare(
    "INSERT INTO products (name, description, price_cents, availability, video_url) VALUES (?, ?, ?, ?, ?)",
  );
  const createColor = db.prepare("INSERT INTO colors (product_id, name, hex) VALUES (?, ?, ?)");
  const createInventory = db.prepare(
    "INSERT INTO inventory (product_id, color_id, size_id, quantity) VALUES (?, ?, NULL, ?)",
  );
  const products = [
    [
      "Maxi Nube Rosa",
      "Maxisudadera amplia y suave para un look cómodo.",
      49900,
      "available",
      "https://www.tiktok.com/@kary.oly/video/7701168685112692020",
    ],
    ["Maxi Cozy Lavanda", "Diseño oversized en tono lavanda.", 54900, "available", null],
    ["Maxi Estrella Negra", "Maxisudadera negra con detalle estampado.", 59900, "available", null],
    ["Maxi Pastel Menta", "Color menta y corte amplio para todos los días.", 49900, "available", null],
    ["Maxi Teddy Beige", "Textura cálida y silueta relajada.", 64900, "available", null],
  ] as const;
  for (const [name, description, price, availability, video] of products) {
    const result = createProduct.run(name, description, price, availability, video);
    const productId = Number(result.lastInsertRowid);
    const category = name.includes("Teddy") ? "Teddy" : "Maxisudaderas";
    createCategory.run(category);
    const categoryId = db.prepare("SELECT id FROM categories WHERE name = ?").get(category) as { id: number };
    db.prepare("INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)").run(productId, categoryId.id);
    const color = createColor.run(
      productId,
      name.includes("Rosa")
        ? "Rosa"
        : name.includes("Lavanda")
          ? "Lavanda"
          : name.includes("Negra")
            ? "Negro"
            : name.includes("Menta")
              ? "Menta"
              : "Beige",
      null,
    );
    createInventory.run(productId, Number(color.lastInsertRowid), 5);
  }
}

migrate();
seed()
  .then(() => {
    console.log("Seed completado.");
    db.close();
  })
  .catch((error: unknown) => {
    console.error(error);
    db.close();
    process.exitCode = 1;
  });
