const API = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

type RecipeItemJoin = {
  name: string;
  unit: string;
};

export type Recipe = {
  id: string;
  menu_item_id: string;
  item_id: string;
  quantity: number;
  items?: RecipeItemJoin | RecipeItemJoin[] | null;
};

export type MenuItem = {
  id: string;
  name: string;
  created_at?: string;
  recipes: Recipe[];
};

export type Order = {
  id: string;
  menu_item_id: string;
  quantity: number;
  status: "調理中" | "完了";
  created_at: string;
  completed_at: string | null;
  menu_items?: { name: string } | { name: string }[] | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API) throw new Error("VITE_API_URL が未設定です");

  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${path} failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

export function getJoinedName<T extends { name: string }>(
  value: T | T[] | null | undefined
) {
  if (!value) return "";
  return Array.isArray(value) ? value[0]?.name ?? "" : value.name;
}

export async function fetchMenuItems(): Promise<MenuItem[]> {
  return request<MenuItem[]>("/menu-items");
}

export async function createMenuItem(name: string): Promise<MenuItem> {
  return request<MenuItem>("/menu-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function addRecipe(params: {
  menu_item_id: string;
  item_id: string;
  quantity: number;
}): Promise<Recipe> {
  return request<Recipe>(`/menu-items/${params.menu_item_id}/recipes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_id: params.item_id,
      quantity: params.quantity,
    }),
  });
}

export async function deleteRecipe(id: string): Promise<void> {
  await request(`/recipes/${id}`, { method: "DELETE" });
}

export async function fetchOrders(): Promise<Order[]> {
  return request<Order[]>("/orders");
}

export async function createOrder(params: {
  menu_item_id: string;
  quantity: number;
}): Promise<Order> {
  return request<Order>("/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function completeOrder(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}/complete`, {
    method: "PATCH",
  });
}
