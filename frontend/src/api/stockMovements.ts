const API = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

export async function createStockMovement(params: {
  item_id: string;
  delta: number;
}) {
  if (!API) throw new Error("VITE_API_URL が未設定です");

  const res = await fetch(`${API}/stock-movements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `createStockMovement failed: ${res.status}`);
  }

  return await res.json();
}

export type StockMovement = {
  id: string;
  item_id: string;
  delta: number;
  created_at: string;
};

export async function fetchStockMovements(params: {
  item_id: string;
  limit?: number;
}): Promise<StockMovement[]> {
  const API = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");
  if (!API) throw new Error("VITE_API_URL が未設定です");

  const limit = params.limit ?? 50;
  const url = new URL(`${API}/stock-movements`);
  url.searchParams.set("item_id", params.item_id);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `fetchStockMovements failed: ${res.status}`);
  }

  return (await res.json()) as StockMovement[];
}

export async function deleteStockMovement(id: string): Promise<void> {
  const API = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");
  if (!API) throw new Error("VITE_API_URL が未設定です");

  const res = await fetch(`${API}/stock-movements/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `deleteStockMovement failed: ${res.status}`);
  }
}
