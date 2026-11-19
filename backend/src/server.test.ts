import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./server.js";

describe("public API", () => {
  it("reports health", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("lists seeded public products without authentication", async () => {
    const response = await request(app).get("/api/products?pageSize=10");
    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThanOrEqual(2);
    expect(response.body.items.every((item: { status: string }) => item.status === "active")).toBe(true);
  });

  it("requires a CSRF token for administrative mutations", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({ username: "Admin", password: "Admin12345" });
    expect(login.status).toBe(200);
    const response = await agent.patch("/api/admin/products/1/status").send({ status: "active" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_INVALID");
  });

  it("updates inventory and restores availability when stock returns", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ username: "Admin", password: "Admin12345" });
    const csrf = (await agent.get("/api/auth/csrf")).body.token as string;
    const zero = await agent
      .put("/api/admin/products/1/inventory")
      .set("x-csrf-token", csrf)
      .send({ colorId: 1, sizeId: null, quantity: 0 });
    expect(zero.status).toBe(200);
    expect(zero.body.availability).toBe("sold_out");
    const positive = await agent
      .put("/api/admin/products/1/inventory")
      .set("x-csrf-token", csrf)
      .send({ colorId: 1, sizeId: null, quantity: 2 });
    expect(positive.status).toBe(200);
    expect(positive.body.availability).toBe("available");
  });

  it("rejects video links from unsupported domains", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ username: "Admin", password: "Admin12345" });
    const csrf = (await agent.get("/api/auth/csrf")).body.token as string;
    const response = await agent
      .post("/api/admin/products")
      .set("x-csrf-token", csrf)
      .send({ name: "Producto inválido", description: "", price: 100, videoUrl: "https://example.com/video" });
    expect(response.status).toBe(400);
  });

  it("completes the administrative-to-public product flow", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ username: "Admin", password: "Admin12345" });
    const csrf = (await agent.get("/api/auth/csrf")).body.token as string;
    const created = await agent
      .post("/api/admin/products")
      .set("x-csrf-token", csrf)
      .send({ name: "Flujo de prueba Wabis", description: "Producto creado en integración.", price: 350 });
    expect(created.status).toBe(201);
    const productId = created.body.id as number;
    const color = await agent
      .post(`/api/admin/products/${productId}/colors`)
      .set("x-csrf-token", csrf)
      .send({ name: "Coral" });
    expect(color.status).toBe(201);
    const inventory = await agent
      .put(`/api/admin/products/${productId}/inventory`)
      .set("x-csrf-token", csrf)
      .send({ colorId: color.body.id, sizeId: null, quantity: 4 });
    expect(inventory.status).toBe(200);
    const publicProduct = await request(app).get(`/api/products/${productId}`);
    expect(publicProduct.status).toBe(200);
    expect(publicProduct.body.name).toBe("Flujo de prueba Wabis");
    expect(publicProduct.body.inventory[0].quantity).toBe(4);
    const removed = await agent
      .delete(`/api/admin/products/${productId}`)
      .set("x-csrf-token", csrf);
    expect(removed.status).toBe(204);
  });
});
