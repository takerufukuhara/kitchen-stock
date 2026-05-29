import { adminHeaders } from "./auth";

export type Item = {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  par_level: number | null;
  current_stock: number; // backendがnumberで返す想定
  created_at?: string;
};

const API = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

/**
 * items一覧（current_stock付き）を取得
 */
export async function fetchItems(): Promise<Item[]> {
  if (!API) {
    throw new Error("VITE_API_URL が未設定です（frontend/.env を確認）");
  }

  const res = await fetch(`${API}/items`, {
    headers: adminHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `fetchItems failed: ${res.status}`);
  }

  return (await res.json()) as Item[];
}

export async function createItem(params: {
  name: string;
  unit: string;
  category?: string | null;
  par_level?: number | null;
}): Promise<Item> {
  const res = await fetch(`${API}/items`, {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `createItem failed: ${res.status}`);
  }

  return (await res.json()) as Item;
}

export async function deleteItem(id: string): Promise<void> {
  const res = await fetch(`${API}/items/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `deleteItem failed: ${res.status}`);
  }
}

export async function updateItem(
  id: string,
  params: {
    name?: string;
    unit?: string;
    category?: string | null;
    par_level?: number | null;
  }
): Promise<Item> {
  const res = await fetch(`${API}/items/${id}`, {
    method: "PATCH",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `updateItem failed: ${res.status}`);
  }

  return (await res.json()) as Item;
}
