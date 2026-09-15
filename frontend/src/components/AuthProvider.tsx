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

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        api.auth.me().then(setUser).catch(() => setUser(null));
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        api.auth.me().then(setUser).catch(() => setUser(null));
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
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
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      setUser(session.user);
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
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      setUser(session.user);
    },
    [bypassMode]
  );

  const logout = useCallback(async () => {
    if (bypassMode) {
      setDevLogoutFlag();
      setUser(null);
      return;
    }

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
