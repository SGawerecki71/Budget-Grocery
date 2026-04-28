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

export default function App() {
  const [budget, setBudget] = useState("");
  const [productName, setProductName] = useState("");
  const [walmartPrice, setWalmartPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [rows, setRows] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    loadData();
  }, []);

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

  const cheapestTotal = useMemo(() => {
    return groupedProducts.reduce((sum, product) => {
      const prices = [product.walmartPrice, product.targetPrice].filter(
        (price): price is number => typeof price === "number"
      );

      if (prices.length === 0) {
        return sum;
      }

      return sum + Math.min(...prices);
    }, 0);
  }, [groupedProducts]);

  const numericBudget = Number(budget) || 0;
  const remaining = numericBudget - cheapestTotal;

  async function saveBudget() {
    const amount = Number(budget);

    if (Number.isNaN(amount) || amount < 0) {
      setError("Enter a valid budget.");
      return;
    }

    try {
      setError("");

      const response = await fetch("/api/budget", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        throw new Error("Failed to save budget.");
      }

      const updatedBudget: { id: number; amount: number } =
        await response.json();

      setBudget(String(updatedBudget.amount));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
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
      setError("");

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
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function removeProduct(productId: number) {
    try {
      setError("");

      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove product.");
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-md">
        <h1 className="text-3xl font-bold">Budget Grocery</h1>
        <p className="mt-2 text-slate-600">
          Compare Walmart and Target prices for your grocery list.
        </p>

        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-medium">Budget</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Enter your budget"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500"
            />
            <button
              onClick={saveBudget}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700"
            >
              Save
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Product Name
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Milk"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500"
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
              placeholder="3.79"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="md:col-span-3">
            <button
              onClick={addComparison}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700"
            >
              Save Comparison
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Budget</p>
            <p className="mt-1 text-2xl font-bold">
              ${numericBudget.toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Cheapest Total</p>
            <p className="mt-1 text-2xl font-bold">
              ${cheapestTotal.toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Remaining</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                remaining < 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              ${remaining.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold">Store Comparisons</h2>

          {loading ? (
            <p className="mt-3 text-slate-500">Loading comparisons...</p>
          ) : groupedProducts.length === 0 ? (
            <p className="mt-3 text-slate-500">No products added yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {groupedProducts.map((product) => {
                const walmart = product.walmartPrice;
                const target = product.targetPrice;

                const cheapestStore =
                  typeof walmart === "number" && typeof target === "number"
                    ? walmart < target
                      ? "Walmart"
                      : target < walmart
                      ? "Target"
                      : "Tie"
                    : "Unknown";

                return (
                  <div
                    key={product.productId}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-lg font-semibold">
                          {product.productName}
                        </p>
                        <p className="text-sm text-slate-500">
                          Cheapest option: {cheapestStore}
                        </p>
                      </div>

                      <button
                        onClick={() => removeProduct(product.productId)}
                        className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div
                        className={`rounded-lg p-3 ${
                          cheapestStore === "Walmart"
                            ? "bg-emerald-100"
                            : "bg-white"
                        }`}
                      >
                        <p className="text-sm text-slate-500">Walmart</p>
                        <p className="text-xl font-bold">
                          $
                          {typeof walmart === "number"
                            ? walmart.toFixed(2)
                            : "--"}
                        </p>
                      </div>

                      <div
                        className={`rounded-lg p-3 ${
                          cheapestStore === "Target"
                            ? "bg-emerald-100"
                            : "bg-white"
                        }`}
                      >
                        <p className="text-sm text-slate-500">Target</p>
                        <p className="text-xl font-bold">
                          $
                          {typeof target === "number"
                            ? target.toFixed(2)
                            : "--"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}