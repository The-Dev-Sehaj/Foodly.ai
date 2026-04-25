import { supabase } from "./supabase";

const BASE = process.env.EXPO_PUBLIC_BACKEND_HTTP_URL ?? "http://localhost:8000";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getHistory(limit = 20) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/history?limit=${limit}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json() as Promise<{ sessions: CookingSession[] }>;
}

export async function getSessionDetail(sessionId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/history/${sessionId}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
}

export async function getProfile() {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/profile`, { headers });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json() as Promise<UserProfile>;
}

export async function updateProfile(updates: Partial<UserProfile>) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/profile`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

export interface CookingSession {
  id: string;
  recipe_name: string | null;
  summary: string | null;
  created_at: string;
  duration_seconds: number;
  completion_percentage: number;
}

export interface UserProfile {
  id: string;
  email: string;
  dietary_restrictions: string[];
  skill_level: string;
  equipment: string[];
}
