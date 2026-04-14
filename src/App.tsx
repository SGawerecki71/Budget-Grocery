import { useEffect, useMemo, useState } from "react";

type Product = {
  id: number;
  name: string;
  price: number;
};

export default function App() {
  const [budget, setBudget] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const totalSpent = useMemo(() => {
    return products.reduce((sum, product) => sum + product.price, 0);
  }, [products]);

  const numericBudget = Number(budget) || 0;
  const remaining = numericBudget - totalSpent;

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/products");
        if (!response.ok) {
          throw new Error("Failed to load products.");
        }

        const data: Product[] = await response.json();
        setProducts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  async function addProduct() {
    const trimmedName = productName.trim();
    const price = Number(productPrice);

    if (!trimmedName || Number.isNaN(price) || price < 0) {
      setError("Enter a valid product name and price.");
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
          price,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add product.");
      }

      const newProduct: Product = await response.json();
      setProducts((current) => [newProduct, ...current]);
      setProductName("");
      setProductPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function removeProduct(id: number) {
    try {
      setError("");

      const response = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove product.");
      }

      setProducts((current) => current.filter((product) => product.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-md">
        <h1 className="text-3xl font-bold">Budget Grocery</h1>
        <p className="mt-2 text-slate-600">
          Enter a budget and save products to the database.
        </p>

        <div className="mt-8 rounded-xl bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-medium">Budget</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Enter your budget"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500"
          />
        </div>

        <div className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Product Name</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Milk"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Product Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={productPrice}
              onChange={(e) => setProductPrice(e.target.value)}
              placeholder="3.99"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="md:col-span-2">
            <button
              onClick={addProduct}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700"
            >
              Add Product
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
            <p className="mt-1 text-2xl font-bold">${numericBudget.toFixed(2)}</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Total Spent</p>
            <p className="mt-1 text-2xl font-bold">${totalSpent.toFixed(2)}</p>
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
          <h2 className="text-xl font-semibold">Products</h2>

          {loading ? (
            <p className="mt-3 text-slate-500">Loading products...</p>
          ) : products.length === 0 ? (
            <p className="mt-3 text-slate-500">No products added yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-slate-500">
                      ${product.price.toFixed(2)}
                    </p>
                  </div>

                  <button
                    onClick={() => removeProduct(product.id)}
                    className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}