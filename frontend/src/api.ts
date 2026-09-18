// Thin API client. All backend calls go through here. Token is injected from
// a module-level cache kept in sync with secure storage by the AuthProvider.
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

// On web the page and backend share the origin and ingress routes `/api` to the
// backend, so a relative base avoids cross-alias CORS issues. Native uses the
// public backend URL from env.
const BASE =
  Platform.OS === "web"
    ? "/api"
    : `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const TOKEN_KEY = "bits_token";

let cachedToken: string | null = null;

export function setToken(token: string | null) {
  cachedToken = token;
}
export function getToken() {
  return cachedToken;
}

export async function loadToken(): Promise<string | null> {
  cachedToken = await storage.secureGet(TOKEN_KEY, null);
  return cachedToken;
}
export async function persistToken(token: string | null) {
  cachedToken = token;
  if (token) await storage.secureSet(TOKEN_KEY, token);
  else await storage.secureRemove(TOKEN_KEY);
}

type Options = {
  method?: string;
  body?: any;
  auth?: boolean;
};

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth && cachedToken) headers.Authorization = `Bearer ${cachedToken}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) || `Erro ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : "Erro na requisição");
  }
  return data as T;
}
