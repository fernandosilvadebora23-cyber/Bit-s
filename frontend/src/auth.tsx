// Auth state: email/password (JWT) + Emergent Google login. One provider owns
// user + token; the root layout gate reacts to the state.
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

import { api, loadToken, persistToken, setToken } from "@/src/api";

WebBrowser.maybeCompleteAuthSession();

export type User = {
  user_id: string;
  email: string;
  name: string;
  phone?: string;
  role: "customer" | "provider" | "admin";
  picture?: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string; email: string; phone: string; password: string; role: string;
  }) => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

async function exchangeSession(sessionId: string) {
  const data = await api<{ token: string; user: User }>("/auth/session", {
    method: "POST",
    body: { session_id: sessionId },
    auth: false,
  });
  await persistToken(data.token);
  return data.user;
}

function extractSessionId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const handledSessions = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch {
      await persistToken(null);
      setToken(null);
      setUser(null);
    }
  }, []);

  const processSessionId = useCallback(async (sessionId: string) => {
    if (handledSessions.current.has(sessionId)) return;
    handledSessions.current.add(sessionId);
    try {
      const u = await exchangeSession(sessionId);
      setUser(u);
    } catch (e) {
      console.warn("Google session exchange failed", e);
    }
  }, []);

  // Bootstrap: web URL session_id first, then stored token.
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const sid = extractSessionId(window.location.hash) || extractSessionId(window.location.search);
          if (sid) {
            await processSessionId(sid);
            const clean = window.location.origin + window.location.pathname;
            window.history.replaceState(window.history.state, "", clean);
            setLoading(false);
            return;
          }
        } else {
          const initial = await Linking.getInitialURL();
          const sid = extractSessionId(initial);
          if (sid) await processSessionId(sid);
        }
        const token = await loadToken();
        if (token) await refresh();
      } finally {
        setLoading(false);
      }
    })();

    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) processSessionId(sid);
    });
    return () => sub.remove();
  }, [processSessionId, refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST", body: { email, password }, auth: false,
    });
    await persistToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (input: any) => {
    const data = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST", body: input, auth: false,
    });
    await persistToken(data.token);
    setUser(data.user);
  }, []);

  const googleLogin = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin + "/"
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let sid: string | null = null;
    if (result.type === "success") sid = extractSessionId(result.url);
    if (!sid) sid = extractSessionId(await Linking.getInitialURL());
    if (sid) await processSessionId(sid);
  }, [processSessionId]);

  const logout = useCallback(async () => {
    await persistToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, googleLogin, logout, refresh }),
    [user, loading, login, register, googleLogin, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
