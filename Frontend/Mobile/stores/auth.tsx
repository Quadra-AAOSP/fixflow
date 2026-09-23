import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as authApi from '@/services/auth';
import { ApiError } from '@/services/auth';
import type { LoginPayload, RegisterPayload, User } from '@/types';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Re-reads the session from `GET /api/auth/me`.
   *
   * Rejects if the call fails for any reason other than an expired session, so
   * the caller can surface offline / server errors. A 401 is *not* an error:
   * it clears `user` (signing the app out) and resolves normally.
   */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      setUser(me);
    } catch (error) {
      // Only an explicit 401 proves the session is gone. Treating every
      // failure as a sign-out would drop the user to the login screen on a
      // transient network blip or a 5xx, so anything else is re-thrown for
      // the caller to handle while the current identity is left intact.
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        return;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const me = await authApi.getMe();
        if (!cancelled) {
          setUser(me);
        }
      } catch {
        // Bootstrap cannot distinguish "no session" from "server unreachable"
        // without a second round-trip, and blocking the splash on a retry is
        // worse than showing the signed-out shell. `refresh` is the path that
        // reports failures properly once the app is interactive.
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const next = await authApi.login(payload);
    setUser(next);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await authApi.register(payload);
    const next = await authApi.login({
      email: payload.email,
      password: payload.password,
    });
    setUser(next);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      refresh,
    }),
    [user, isLoading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
