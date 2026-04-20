/*
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "database.db");
const db = new Database(dbPath);

const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf-8");
db.exec(schema);

// Add your API routes here
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(3000, () => console.log("API running on http://localhost:3000"));
*/
// older code, ignore for now

import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "database.db");
const db = new Database(dbPath);

const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf-8");
db.exec(schema);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/stores", (_req, res) => {
  const stores = db.prepare("SELECT id, name FROM stores ORDER BY name").all();
  res.json(stores);
});

app.get("/api/products", (_req, res) => {
  const products = db
    .prepare(
      `
      SELECT
        p.id,
        p.name
      FROM products p
      ORDER BY p.name
      `
    )
    .all();

  res.json(products);
});

app.get("/api/comparisons", (_req, res) => {
  const comparisons = db
    .prepare(
      `
      SELECT
        p.id AS productId,
        p.name AS productName,
        s.name AS storeName,
        sp.price AS price,
        sp.last_updated AS lastUpdated
      FROM store_prices sp
      JOIN products p ON sp.product_id = p.id
      JOIN stores s ON sp.store_id = s.id
      ORDER BY p.name, s.name
      `
    )
    .all();

  res.json(comparisons);
});

app.post("/api/products", (req, res) => {
  const { name, walmartPrice, targetPrice } = req.body as {
    name?: string;
    walmartPrice?: number;
    targetPrice?: number;
  };

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Product name is required." });
  }

  if (
    typeof walmartPrice !== "number" ||
    Number.isNaN(walmartPrice) ||
    walmartPrice < 0 ||
    typeof targetPrice !== "number" ||
    Number.isNaN(targetPrice) ||
    targetPrice < 0
  ) {
    return res.status(400).json({
      error: "Valid Walmart and Target prices are required.",
    });
  }

  const cleanName = name.trim();

  const insertProduct = db
    .prepare("INSERT OR IGNORE INTO products (name) VALUES (?)");
  insertProduct.run(cleanName);

  const product = db
    .prepare("SELECT id, name FROM products WHERE name = ?")
    .get(cleanName) as { id: number; name: string } | undefined;

  if (!product) {
    return res.status(500).json({ error: "Failed to create product." });
  }

  const walmart = db
    .prepare("SELECT id FROM stores WHERE name = 'Walmart'")
    .get() as { id: number };
  const target = db
    .prepare("SELECT id FROM stores WHERE name = 'Target'")
    .get() as { id: number };

  const upsertPrice = db.prepare(`
    INSERT INTO store_prices (product_id, store_id, price)
    VALUES (?, ?, ?)
    ON CONFLICT(product_id, store_id)
    DO UPDATE SET
      price = excluded.price,
      last_updated = CURRENT_TIMESTAMP
  `);

  upsertPrice.run(product.id, walmart.id, walmartPrice);
  upsertPrice.run(product.id, target.id, targetPrice);

  const result = db
    .prepare(
      `
      SELECT
        p.id AS productId,
        p.name AS productName,
        s.name AS storeName,
        sp.price AS price,
        sp.last_updated AS lastUpdated
      FROM store_prices sp
      JOIN products p ON sp.product_id = p.id
      JOIN stores s ON sp.store_id = s.id
      WHERE p.id = ?
      ORDER BY s.name
      `
    )
    .all(product.id);

  res.status(201).json(result);
});

app.delete("/api/products/:id", (req, res) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid product id." });
  }

  const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Product not found." });
  }

  res.status(204).send();
});

app.listen(3000, () => {
  console.log("API running on http://localhost:3000");
});