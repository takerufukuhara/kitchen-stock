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
  category: string | null;
  prep_required: boolean;
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
    | {
        label: string | null;
        table_id?: string | null;
        party_size?: number | null;
        closed_at?: string | null;
      }
    | {
        label: string | null;
        table_id?: string | null;
        party_size?: number | null;
        closed_at?: string | null;
      }[]
    | null;
};

export type StaffCall = {
  id: string;
  customer_group_id: string | null;
  created_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  customer_groups?:
    | { label: string | null; table_id?: string | null; party_size?: number | null }
    | { label: string | null; table_id?: string | null; party_size?: number | null }[]
    | null;
};

export type CustomerGroup = {
  id: string;
  label: string | null;
  table_id: string | null;
  party_size: number | null;
  created_at: string;
  closed_at: string | null;
  checkout_requested_at: string | null;
};

export type CustomerGroupOption = {
  table_id: string | null;
  label: string;
  active_group: CustomerGroup | null;
};

export type DiningTable = {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type OrderStartMode = "staff" | "customer";

export type AppSettings = {
  order_start_mode: OrderStartMode;
};

export type ClosingReport = {
  id: string;
  business_date: string;
  completed_at: string;
  checklist_total: number;
  checklist_completed: number;
  order_count: number;
  completed_order_count: number;
  active_order_count: number;
  canceled_order_count: number;
  stock_movement_count: number;
  stock_reconciliation_issue_count: number;
  checklist_items: { key: string; label: string; checked: boolean }[];
  created_at: string;
};

export type OpeningReport = {
  id: string;
  business_date: string;
  completed_at: string;
  checklist_total: number;
  checklist_completed: number;
  checklist_items: { key: string; label: string; checked: boolean }[];
  created_at: string;
};

export type OpeningChecklistItem = {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API) throw new Error("VITE_API_URL が未設定です");

  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${path} failed: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
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

export async function createMenuItem(params: {
  name: string;
  category?: string | null;
  prep_required?: boolean;
}): Promise<MenuItem> {
  return request<MenuItem>("/menu-items", {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
  });
}

export async function updateMenuItem(
  id: string,
  params: {
    name?: string;
    category?: string | null;
    prep_required?: boolean;
  }
): Promise<MenuItem> {
  return request<MenuItem>(`/menu-items/${id}`, {
    method: "PATCH",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
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

export async function fetchClosingReports(): Promise<ClosingReport[]> {
  return request<ClosingReport[]>("/closing-reports", {
    headers: adminHeaders(),
  });
}

export async function createClosingReport(params: {
  business_date: string;
  checklist_total: number;
  checklist_completed: number;
  order_count: number;
  completed_order_count: number;
  active_order_count: number;
  canceled_order_count: number;
  stock_movement_count: number;
  stock_reconciliation_issue_count: number;
  checklist_items: { key: string; label: string; checked: boolean }[];
}): Promise<ClosingReport> {
  return request<ClosingReport>("/closing-reports", {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
  });
}

export async function fetchOpeningReports(): Promise<OpeningReport[]> {
  return request<OpeningReport[]>("/opening-reports", {
    headers: adminHeaders(),
  });
}

export async function fetchOpeningChecklistItems(): Promise<OpeningChecklistItem[]> {
  return request<OpeningChecklistItem[]>("/opening-checklist-items", {
    headers: adminHeaders(),
  });
}

export async function createOpeningChecklistItem(
  label: string
): Promise<OpeningChecklistItem> {
  return request<OpeningChecklistItem>("/opening-checklist-items", {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ label }),
  });
}

export async function deleteOpeningChecklistItem(id: string): Promise<void> {
  await request(`/opening-checklist-items/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
}

export async function createOpeningReport(params: {
  business_date: string;
  checklist_total: number;
  checklist_completed: number;
  checklist_items: { key: string; label: string; checked: boolean }[];
}): Promise<OpeningReport> {
  return request<OpeningReport>("/opening-reports", {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
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

export async function fetchAppSettings(): Promise<AppSettings> {
  return request<AppSettings>("/app-settings");
}

export async function updateAppSettings(
  params: AppSettings
): Promise<AppSettings> {
  return request<AppSettings>("/app-settings", {
    method: "PATCH",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
  });
}

export async function fetchTables(): Promise<DiningTable[]> {
  return request<DiningTable[]>("/tables", {
    headers: adminHeaders(),
  });
}

export async function createTable(label: string): Promise<DiningTable> {
  return request<DiningTable>("/tables", {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ label }),
  });
}

export async function updateTable(
  id: string,
  params: { label?: string; sort_order?: number }
): Promise<DiningTable> {
  return request<DiningTable>(`/tables/${id}`, {
    method: "PATCH",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
  });
}

export async function deleteTable(id: string): Promise<void> {
  await request(`/tables/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
}

export async function createCustomerGroup(
  params: string | { label?: string; table_id?: string },
  options?: { admin?: boolean }
): Promise<CustomerGroup> {
  const body = typeof params === "string" ? { label: params } : params;

  return request<CustomerGroup>("/customer-groups", {
    method: "POST",
    headers: options?.admin
      ? adminHeaders({ "Content-Type": "application/json" })
      : { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

export async function requestCustomerGroupCheckout(id: string): Promise<CustomerGroup> {
  return request<CustomerGroup>(`/customer-groups/${id}/request-checkout`, {
    method: "PATCH",
  });
}

export async function updateCustomerGroupPartySize(
  id: string,
  party_size: number
): Promise<CustomerGroup> {
  return request<CustomerGroup>(`/customer-groups/${id}/party-size`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ party_size }),
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

export async function deleteOrder(id: string): Promise<void> {
  await request(`/orders/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
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

export async function createStaffCall(customer_group_id: string): Promise<StaffCall> {
  return request<StaffCall>("/staff-calls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_group_id }),
  });
}

export async function fetchStaffCall(id: string): Promise<StaffCall> {
  return request<StaffCall>(`/staff-calls/${id}`);
}

export async function cancelStaffCall(id: string): Promise<StaffCall> {
  return request<StaffCall>(`/staff-calls/${id}/cancel`, {
    method: "PATCH",
  });
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
