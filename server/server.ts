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

type ProductCount = { count: number };
type StoreRow = { id: number; name: string };
type ProductRow = { id: number; name: string };
type ComparisonRow = {
  productId: number;
  productName: string;
  storeName: string;
  price: number;
  lastUpdated: string;
};

type BasketItem = {
  productId: number;
  quantity: number;
};

function seedSampleProducts() {
  const productCount = db
    .prepare("SELECT COUNT(*) as count FROM products")
    .get() as ProductCount;

  if (productCount.count > 0) {
    return;
  }

  const sampleProducts = [
    { name: "Milk", walmart: 3.48, target: 3.29 },
    { name: "Eggs", walmart: 2.99, target: 3.19 },
    { name: "Bread", walmart: 2.49, target: 2.29 },
    { name: "Rice", walmart: 5.99, target: 6.49 },
    { name: "Chicken", walmart: 8.99, target: 8.79 },
    { name: "Apples", walmart: 4.29, target: 4.59 },
    { name: "Bananas", walmart: 1.29, target: 1.19 },
    { name: "Cereal", walmart: 3.99, target: 4.29 },
    { name: "Pasta", walmart: 1.99, target: 2.19 },
    { name: "Cheese", walmart: 4.49, target: 4.79 },
  ];

  const walmart = db
    .prepare("SELECT id, name FROM stores WHERE name = 'Walmart'")
    .get() as StoreRow | undefined;

  const target = db
    .prepare("SELECT id, name FROM stores WHERE name = 'Target'")
    .get() as StoreRow | undefined;

  if (!walmart || !target) {
    throw new Error("Walmart or Target not found in stores table.");
  }

  const insertProduct = db.prepare(
    "INSERT OR IGNORE INTO products (name) VALUES (?)"
  );

  const getProduct = db.prepare("SELECT id, name FROM products WHERE name = ?");

  const upsertPrice = db.prepare(`
    INSERT INTO store_prices (product_id, store_id, price)
    VALUES (?, ?, ?)
    ON CONFLICT(product_id, store_id)
    DO UPDATE SET
      price = excluded.price,
      last_updated = CURRENT_TIMESTAMP
  `);

  for (const item of sampleProducts) {
    insertProduct.run(item.name);

    const product = getProduct.get(item.name) as ProductRow | undefined;

    if (!product) {
      throw new Error(`Failed to insert or find product: ${item.name}`);
    }

    upsertPrice.run(product.id, walmart.id, item.walmart);
    upsertPrice.run(product.id, target.id, item.target);
  }

  console.log("Sample products inserted");
}

function getComparisons(): ComparisonRow[] {
  return db
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
    .all() as ComparisonRow[];
}

function optimizeBasket(items?: BasketItem[]) {
  const comparisons = getComparisons();
  const quantityMap = new Map<number, number>();

  if (items && items.length > 0) {
    for (const item of items) {
      if (
        typeof item.productId === "number" &&
        typeof item.quantity === "number" &&
        item.quantity > 0
      ) {
        quantityMap.set(item.productId, item.quantity);
      }
    }
  }

  const productMap = new Map<
    number,
    {
      productId: number;
      productName: string;
      quantity: number;
      prices: { storeName: string; price: number }[];
    }
  >();

  for (const row of comparisons) {
    const quantity = quantityMap.get(row.productId) ?? 1;

    if (!productMap.has(row.productId)) {
      productMap.set(row.productId, {
        productId: row.productId,
        productName: row.productName,
        quantity,
        prices: [],
      });
    }

    productMap.get(row.productId)!.prices.push({
      storeName: row.storeName,
      price: row.price,
    });
  }

  const itemsResult = Array.from(productMap.values()).map((product) => {
    const cheapest = product.prices.reduce((best, current) =>
      current.price < best.price ? current : best
    );

    return {
      productId: product.productId,
      productName: product.productName,
      quantity: product.quantity,
      cheapestStore: cheapest.storeName,
      cheapestPrice: cheapest.price,
      lineTotal: cheapest.price * product.quantity,
      prices: product.prices,
    };
  });

  const cheapestTotal = itemsResult.reduce((sum, item) => sum + item.lineTotal, 0);

  const storeTotals = new Map<string, number>();
  for (const item of itemsResult) {
    for (const price of item.prices) {
      storeTotals.set(
        price.storeName,
        (storeTotals.get(price.storeName) ?? 0) + price.price * item.quantity
      );
    }
  }

  const storeComparison = Array.from(storeTotals.entries())
    .map(([storeName, total]) => ({ storeName, total }))
    .sort((a, b) => a.total - b.total);

  const bestSingleStore = storeComparison[0] ?? null;
  const savingsVsBestSingleStore = bestSingleStore
    ? bestSingleStore.total - cheapestTotal
    : 0;

  return {
    cheapestTotal,
    itemCount: itemsResult.length,
    totalUnits: itemsResult.reduce((sum, item) => sum + item.quantity, 0),
    bestSingleStore,
    savingsVsBestSingleStore,
    storeComparison,
    items: itemsResult,
  };
}

seedSampleProducts();

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
  res.json(getComparisons());
});

app.get("/api/summary", (_req, res) => {
  const comparisons = getComparisons();
  const productIds = new Set(comparisons.map((row) => row.productId));
  const stores = new Set(comparisons.map((row) => row.storeName));
  const optimized = optimizeBasket();

  res.json({
    productCount: productIds.size,
    storeCount: stores.size,
    cheapestTotal: optimized.cheapestTotal,
    bestSingleStore: optimized.bestSingleStore,
    savingsVsBestSingleStore: optimized.savingsVsBestSingleStore,
  });
});

app.get("/api/basket/optimize", (_req, res) => {
  res.json(optimizeBasket());
});

app.post("/api/basket/optimize", (req, res): void => {
  const { items } = req.body as { items?: BasketItem[] };

  if (items !== undefined && !Array.isArray(items)) {
    res.status(400).json({ error: "Items must be an array." });
    return;
  }

  res.json(optimizeBasket(items));
});

app.post("/api/products", (req, res): void => {
  const { name, walmartPrice, targetPrice } = req.body as {
    name?: string;
    walmartPrice?: number;
    targetPrice?: number;
  };

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Product name is required." });
    return;
  }

  if (
    typeof walmartPrice !== "number" ||
    Number.isNaN(walmartPrice) ||
    walmartPrice < 0 ||
    typeof targetPrice !== "number" ||
    Number.isNaN(targetPrice) ||
    targetPrice < 0
  ) {
    res.status(400).json({
      error: "Valid Walmart and Target prices are required.",
    });
    return;
  }

  const cleanName = name.trim();

  db.prepare("INSERT OR IGNORE INTO products (name) VALUES (?)").run(cleanName);

  const product = db
    .prepare("SELECT id, name FROM products WHERE name = ?")
    .get(cleanName) as ProductRow | undefined;

  if (!product) {
    res.status(500).json({ error: "Failed to create product." });
    return;
  }

  const walmart = db
    .prepare("SELECT id, name FROM stores WHERE name = 'Walmart'")
    .get() as StoreRow | undefined;

  const target = db
    .prepare("SELECT id, name FROM stores WHERE name = 'Target'")
    .get() as StoreRow | undefined;

  if (!walmart || !target) {
    res.status(500).json({ error: "Required stores not found." });
    return;
  }

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

app.delete("/api/products/:id", (req, res): void => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }

  const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: "Product not found." });
    return;
  }

  res.status(204).send();
});

app.get("/api/budget", (_req, res) => {
  const budget = db
    .prepare("SELECT id, amount FROM budgets WHERE id = 1")
    .get() as { id: number; amount: number } | undefined;

  res.json(budget ?? { id: 1, amount: 0 });
});

app.put("/api/budget", (req, res) => {
  const { amount } = req.body as { amount?: number };

  if (typeof amount !== "number" || Number.isNaN(amount) || amount < 0) {
    return res.status(400).json({ error: "Valid budget amount is required." });
  }

  db.prepare(`
    INSERT INTO budgets (id, amount)
    VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET amount = excluded.amount
  `).run(amount);

  const updatedBudget = db
    .prepare("SELECT id, amount FROM budgets WHERE id = 1")
    .get() as { id: number; amount: number };

  res.json(updatedBudget);
});

app.listen(3000, () => {
  console.log("API running on http://localhost:3000");
});
