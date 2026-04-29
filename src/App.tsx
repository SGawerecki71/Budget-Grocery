import { useEffect, useMemo, useState } from "react";

type ComparisonRow = {
  productId: number;
  productName: string;
  storeName: string;
  price: number;
  lastUpdated: string;
};

type GroupedProduct = {
  productId: number;
  productName: string;
  walmartPrice?: number;
  targetPrice?: number;
};

type OptimizedItem = {
  productId: number;
  productName: string;
  quantity: number;
  cheapestStore: string;
  cheapestPrice: number;
  lineTotal: number;
};

type OptimizedBasket = {
  cheapestTotal: number;
  itemCount: number;
  totalUnits: number;
  bestSingleStore: { storeName: string; total: number } | null;
  savingsVsBestSingleStore: number;
  storeComparison: { storeName: string; total: number }[];
  items: OptimizedItem[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function App() {
  const [budget, setBudget] = useState("50");
  const [productName, setProductName] = useState("");
  const [walmartPrice, setWalmartPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [rows, setRows] = useState<ComparisonRow[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [optimizedBasket, setOptimizedBasket] = useState<OptimizedBasket | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [comparisonResponse, budgetResponse] = await Promise.all([
        fetch("/api/comparisons"),
        fetch("/api/budget"),
      ]);

      if (!comparisonResponse.ok) {
        throw new Error("Failed to load comparisons.");
      }

      if (!budgetResponse.ok) {
        throw new Error("Failed to load budget.");
      }

      const comparisonData: ComparisonRow[] = await comparisonResponse.json();
      const budgetData: { id: number; amount: number } =
        await budgetResponse.json();

      setRows(comparisonData);
      setBudget(String(budgetData.amount));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function loadOptimizedBasket(nextQuantities = quantities) {
    try {
      const items = Object.entries(nextQuantities).map(
        ([productId, quantity]) => ({
          productId: Number(productId),
          quantity,
        })
      );

      const response = await fetch("/api/basket/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        throw new Error("Failed to optimize basket.");
      }

      const data: OptimizedBasket = await response.json();
      setOptimizedBasket(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (rows.length === 0) {
      return;
    }

    const defaultQuantities: Record<number, number> = {};
    for (const row of rows) {
      defaultQuantities[row.productId] = quantities[row.productId] ?? 1;
    }

    setQuantities(defaultQuantities);
    loadOptimizedBasket(defaultQuantities);
  }, [rows]);

  const groupedProducts = useMemo(() => {
    const map = new Map<number, GroupedProduct>();

    for (const row of rows) {
      if (!map.has(row.productId)) {
        map.set(row.productId, {
          productId: row.productId,
          productName: row.productName,
        });
      }

      const product = map.get(row.productId)!;

      if (row.storeName === "Walmart") {
        product.walmartPrice = row.price;
      }

      if (row.storeName === "Target") {
        product.targetPrice = row.price;
      }
    }

    return Array.from(map.values());
  }, [rows]);

  const numericBudget = Number(budget) || 0;
  const cheapestTotal = optimizedBasket?.cheapestTotal ?? 0;
  const remaining = numericBudget - cheapestTotal;
  const targetTotal = optimizedBasket?.storeComparison.find(
    (store) => store.storeName === "Target"
  )?.total;
  const walmartTotal = optimizedBasket?.storeComparison.find(
    (store) => store.storeName === "Walmart"
  )?.total;

  function updateQuantity(productId: number, quantityValue: string) {
    const quantity = Math.max(1, Number(quantityValue) || 1);
    const nextQuantities = {
      ...quantities,
      [productId]: quantity,
    };

    setQuantities(nextQuantities);
    loadOptimizedBasket(nextQuantities);
  }

  async function addComparison() {
    const trimmedName = productName.trim();
    const walmart = Number(walmartPrice);
    const target = Number(targetPrice);

    if (!trimmedName) {
      setError("Product name is required.");
      return;
    }

    if (
      Number.isNaN(walmart) ||
      walmart < 0 ||
      Number.isNaN(target) ||
      target < 0
    ) {
      setError("Enter valid prices for Walmart and Target.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          walmartPrice: walmart,
          targetPrice: target,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save product comparison.");
      }

      setProductName("");
      setWalmartPrice("");
      setTargetPrice("");
      setSuccess("Product comparison saved.");
      await loadComparisons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(productId: number) {
    try {
      setError("");
      setSuccess("");

      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove product.");
      }

      setSuccess("Product removed.");
      await loadComparisons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl bg-gradient-to-br from-emerald-700 to-slate-900 p-8 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
            Smart Grocery Budgeting Assistant
          </p>
          <h1 className="mt-2 text-4xl font-bold">Budget Grocery</h1>
          <p className="mt-3 max-w-2xl text-emerald-50">
            Compare Walmart and Target prices, adjust quantities, and find the
            cheapest basket for your grocery budget.
          </p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Budget</p>
            <input
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-2xl font-bold outline-none focus:border-emerald-500"
            />
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Cheapest Basket</p>
            <p className="mt-2 text-3xl font-bold">
              {currency.format(cheapestTotal)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Remaining</p>
            <p
              className={`mt-2 text-3xl font-bold ${remaining < 0 ? "text-red-600" : "text-emerald-600"
                }`}
            >
              {currency.format(remaining)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Best Single Store</p>
            <p className="mt-2 text-3xl font-bold">
              {optimizedBasket?.bestSingleStore?.storeName ?? "--"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {optimizedBasket?.totalUnits ?? 0} total items
            </p>
          </div>
        </section>

        <main className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Add Product</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add or update grocery prices for both stores.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Product Name
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Orange juice"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Walmart Price
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={walmartPrice}
                  onChange={(e) => setWalmartPrice(e.target.value)}
                  placeholder="3.48"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Target Price
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="3.29"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500"
                />
              </div>

              <button
                onClick={addComparison}
                disabled={saving}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {saving ? "Saving..." : "Save Comparison"}
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            )}

            <div className="mt-6 rounded-2xl bg-slate-50 p-4">
              <h3 className="font-semibold">Store totals</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Walmart only</span>
                  <strong>{currency.format(walmartTotal ?? 0)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Target only</span>
                  <strong>{currency.format(targetTotal ?? 0)}</strong>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span>Mixed cheapest basket</span>
                  <strong className="text-emerald-700">
                    {currency.format(cheapestTotal)}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold">Price Comparison</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update quantities to recalculate the optimized basket.
                </p>
              </div>
              <p className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                Savings: {currency.format(optimizedBasket?.savingsVsBestSingleStore ?? 0)}
              </p>
            </div>

            {loading ? (
              <p className="mt-6 text-slate-500">Loading comparisons...</p>
            ) : groupedProducts.length === 0 ? (
              <p className="mt-6 text-slate-500">No products added yet.</p>
            ) : (
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Walmart</th>
                      <th className="px-4 py-3">Target</th>
                      <th className="px-4 py-3">Cheapest</th>
                      <th className="px-4 py-3">Line Total</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupedProducts.map((product) => {
                      const optimizedItem = optimizedBasket?.items.find(
                        (item) => item.productId === product.productId
                      );
                      const quantity = quantities[product.productId] ?? 1;
                      const cheapestStore = optimizedItem?.cheapestStore ?? "--";

                      return (
                        <tr key={product.productId} className="bg-white">
                          <td className="px-4 py-3 font-semibold">
                            {product.productName}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="1"
                              value={quantity}
                              onChange={(e) =>
                                updateQuantity(product.productId, e.target.value)
                              }
                              className="w-20 rounded-lg border border-slate-300 px-2 py-1 outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td
                            className={`px-4 py-3 ${cheapestStore === "Walmart"
                              ? "font-bold text-emerald-700"
                              : ""
                              }`}
                          >
                            {typeof product.walmartPrice === "number"
                              ? currency.format(product.walmartPrice)
                              : "--"}
                          </td>
                          <td
                            className={`px-4 py-3 ${cheapestStore === "Target"
                              ? "font-bold text-emerald-700"
                              : ""
                              }`}
                          >
                            {typeof product.targetPrice === "number"
                              ? currency.format(product.targetPrice)
                              : "--"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              {cheapestStore}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold">
                            {currency.format(optimizedItem?.lineTotal ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => removeProduct(product.productId)}
                              className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
