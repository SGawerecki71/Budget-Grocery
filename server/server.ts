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

app.get("/api/products", (_req, res) => {
  const products = db
    .prepare("SELECT id, name, price FROM products ORDER BY id DESC")
    .all();

  res.json(products);
});

app.post("/api/products", (req, res) => {
  const { name, price } = req.body as { name?: string; price?: number };

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Product name is required." });
  }

  if (typeof price !== "number" || Number.isNaN(price) || price < 0) {
    return res.status(400).json({ error: "Valid product price is required." });
  }

  const result = db
    .prepare("INSERT INTO products (name, price) VALUES (?, ?)")
    .run(name.trim(), price);

  const newProduct = db
    .prepare("SELECT id, name, price FROM products WHERE id = ?")
    .get(result.lastInsertRowid);

  res.status(201).json(newProduct);
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