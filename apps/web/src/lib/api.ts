import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || "";
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}

export async function apiPost(path: string, body: object) {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`API error: ${resp.status}`);
  }
  return resp.json();
}

export async function apiGet(path: string) {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${API_URL}${path}`, { headers });
  if (!resp.ok) {
    throw new Error(`API error: ${resp.status}`);
  }
  return resp.json();
}

export async function apiDelete(path: string) {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers,
  });
  if (!resp.ok) {
    throw new Error(`API error: ${resp.status}`);
  }
  return resp.json();
}
