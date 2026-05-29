const API = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

const ADMIN_TOKEN_KEY = "kitchen-stock-admin-token";

export function getAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function adminHeaders(headers?: HeadersInit): HeadersInit {
  const token = getAdminToken();

  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function loginAdmin(password: string): Promise<string> {
  if (!API) throw new Error("VITE_API_URL が未設定です");

  const res = await fetch(`${API}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `login failed: ${res.status}`);
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}
