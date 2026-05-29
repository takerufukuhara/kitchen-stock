import { adminHeaders } from "./auth";

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
  customer_group_id: string | null;
  quantity: number;
  status: "調理待ち" | "調理中" | "完了" | "キャンセル";
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_confirmed_at: string | null;
  staff_called_at: string | null;
  staff_call_confirmed_at: string | null;
  menu_items?: { name: string } | { name: string }[] | null;
  customer_groups?:
    | { label: string | null; closed_at?: string | null }
    | { label: string | null; closed_at?: string | null }[]
    | null;
};

export type StaffCall = {
  id: string;
  created_at: string;
  confirmed_at: string | null;
};

export type CustomerGroup = {
  id: string;
  label: string | null;
  created_at: string;
  closed_at: string | null;
};

export type CustomerGroupOption = {
  label: string;
  active_group: CustomerGroup | null;
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
  return request<MenuItem[]>("/menu-items", {
    headers: adminHeaders(),
  });
}

export async function fetchPublicMenuItems(): Promise<MenuItem[]> {
  return request<MenuItem[]>("/public/menu-items");
}

export async function createMenuItem(name: string): Promise<MenuItem> {
  return request<MenuItem>("/menu-items", {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
}

export async function deleteMenuItem(id: string): Promise<void> {
  await request(`/menu-items/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
}

export async function addRecipe(params: {
  menu_item_id: string;
  item_id: string;
  quantity: number;
}): Promise<Recipe> {
  return request<Recipe>(`/menu-items/${params.menu_item_id}/recipes`, {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      item_id: params.item_id,
      quantity: params.quantity,
    }),
  });
}

export async function deleteRecipe(id: string): Promise<void> {
  await request(`/recipes/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
}

export async function fetchOrders(): Promise<Order[]> {
  return request<Order[]>("/orders", {
    headers: adminHeaders(),
  });
}

export async function createOrder(params: {
  menu_item_id: string;
  quantity: number;
  customer_group_id?: string | null;
}): Promise<Order> {
  return request<Order>("/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function createCustomerGroup(label: string): Promise<CustomerGroup> {
  return request<CustomerGroup>("/customer-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
}

export async function fetchCustomerGroupOptions(): Promise<CustomerGroupOption[]> {
  return request<CustomerGroupOption[]>("/customer-groups");
}

export async function fetchCustomerGroup(id: string): Promise<CustomerGroup> {
  return request<CustomerGroup>(`/customer-groups/${id}`);
}

export async function checkoutCustomerGroup(id: string): Promise<CustomerGroup> {
  return request<CustomerGroup>(`/customer-groups/${id}/checkout`, {
    method: "PATCH",
    headers: adminHeaders(),
  });
}

export async function fetchOrderStatus(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}/status`);
}

export async function completeOrder(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}/complete`, {
    method: "PATCH",
    headers: adminHeaders(),
  });
}

export async function startCookingOrder(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}/start-cooking`, {
    method: "PATCH",
    headers: adminHeaders(),
  });
}

export async function cancelOrder(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}/cancel`, {
    method: "PATCH",
  });
}

export async function confirmOrderCancellation(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}/confirm-cancel`, {
    method: "PATCH",
    headers: adminHeaders(),
  });
}

export async function callStaff(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}/call-staff`, {
    method: "PATCH",
  });
}

export async function confirmStaffCall(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}/confirm-staff-call`, {
    method: "PATCH",
    headers: adminHeaders(),
  });
}

export async function createStaffCall(): Promise<StaffCall> {
  return request<StaffCall>("/staff-calls", {
    method: "POST",
  });
}

export async function fetchStaffCall(id: string): Promise<StaffCall> {
  return request<StaffCall>(`/staff-calls/${id}`);
}

export async function fetchStaffCalls(): Promise<StaffCall[]> {
  return request<StaffCall[]>("/staff-calls", {
    headers: adminHeaders(),
  });
}

export async function confirmStandaloneStaffCall(id: string): Promise<StaffCall> {
  return request<StaffCall>(`/staff-calls/${id}/confirm`, {
    method: "PATCH",
    headers: adminHeaders(),
  });
}
