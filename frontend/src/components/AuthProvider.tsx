/**
 * Authentication context provider.
 *
 * In local dev, auth is bypassed by default so the UI can be explored
 * without Supabase or the backend running. Set VITE_AUTH_BYPASS=false
 * (see frontend/.env.example) when you are ready to test real login.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser, LoginRequest, RegisterRequest } from "@/types";
import { api } from "@/lib/api";
import {
  clearDevLogoutFlag,
  createDemoUser,
  hasDevLogoutFlag,
  isAuthBypassEnabled,
  setDevLogoutFlag,
} from "@/lib/auth/bypass";
import { setAccessToken } from "@/lib/auth/token";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isBypassMode: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  enterDemo: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Build AuthUser from a Supabase session when /auth/me is unavailable. */
function userFromSession(session: {
  access_token: string;
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> };
}): AuthUser {
  const meta = session.user.user_metadata as { full_name?: string } | undefined;
  return {
    id: String(session.user.id),
    email: session.user.email ?? "",
    full_name: meta?.full_name ?? null,
  };
}

async function resolveUserFromSession(session: {
  access_token: string;
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> };
}): Promise<AuthUser> {
  try {
    // Pass token explicitly — never call getSession() under onAuthStateChange.
    const me = await api.auth.me(session.access_token);
    return { ...me, id: String(me.id) };
  } catch {
    // Keep the session user if /auth/me fails (JWT sync / API blip).
    return userFromSession(session);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const bypassMode = isAuthBypassEnabled();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const enterDemo = useCallback(() => {
    clearDevLogoutFlag();
    setUser(createDemoUser());
  }, []);

  useEffect(() => {
    if (bypassMode) {
      if (!hasDevLogoutFlag()) {
        setUser(createDemoUser());
      }
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setAccessToken(data.session.access_token);
        const next = await resolveUserFromSession(data.session);
        if (!cancelled) setUser(next);
      } else {
        setAccessToken(null);
      }
      if (!cancelled) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // setTimeout(0): never touch auth/network while Supabase holds the auth lock
      // (await getSession inside this callback deadlocks setSession → stuck "Signing in...").
      window.setTimeout(() => {
        if (cancelled) return;
        if (!session) {
          setAccessToken(null);
          setUser(null);
          return;
        }
        setAccessToken(session.access_token);
        void resolveUserFromSession(session).then((next) => {
          if (!cancelled) setUser(next);
        });
      }, 0);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [bypassMode]);

  const login = useCallback(
    async (payload: LoginRequest) => {
      if (bypassMode) {
        clearDevLogoutFlag();
        setUser(
          createDemoUser({
            email: payload.email,
            full_name: payload.email.split("@")[0],
          })
        );
        return;
      }

      const session = await api.auth.login(payload);
      setAccessToken(session.access_token);
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) {
        setAccessToken(null);
        throw new Error(error.message || "Failed to establish session");
      }
      // Normalize id to string in case JSON ever varies; keep UI unblocked.
      setUser({ ...session.user, id: String(session.user.id) });
    },
    [bypassMode]
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      if (bypassMode) {
        clearDevLogoutFlag();
        setUser(
          createDemoUser({
            email: payload.email,
            full_name: payload.full_name,
          })
        );
        return;
      }

      const session = await api.auth.register(payload);
      setAccessToken(session.access_token);
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) {
        setAccessToken(null);
        throw new Error(error.message || "Failed to establish session");
      }
      setUser({ ...session.user, id: String(session.user.id) });
    },
    [bypassMode]
  );

  const logout = useCallback(async () => {
    if (bypassMode) {
      setDevLogoutFlag();
      setUser(null);
      return;
    }

    setAccessToken(null);
    await supabase.auth.signOut();
    setUser(null);
  }, [bypassMode]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isBypassMode: bypassMode,
      login,
      register,
      enterDemo,
      logout,
    }),
    [user, loading, bypassMode, login, register, enterDemo, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
