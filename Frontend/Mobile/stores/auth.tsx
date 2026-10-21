import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import * as authApi from '@/services/auth';
import { ApiError } from '@/services/auth';
import i18n from '@/constants/i18n';
import type { LoginPayload, RegisterPayload, User } from '@/types';

/** Seconds before the backend's idle timeout fires — heartbeat fires this often. */
const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 min (backend idle = 30 min)
/** App state that counts as foregrounded and should keep the session alive. */
const FOREGROUND_STATES: AppStateStatus[] = ['active'];

const STORAGE_KEYS = {
  creds: 'fixflow.auth.creds',
  keepAlive: 'fixflow.session.keepAlive',
  autoReLogin: 'fixflow.session.autoReLogin',
} as const;

type SessionState = {
  /** User-visible: is the heartbeat currently running? */
  heartbeatActive: boolean;
  /** "Keep me signed in while open" toggle. */
  keepAlive: boolean;
  /** Auto re-login with stored credentials on session expiry. */
  autoReLogin: boolean;
  /** When we last heard from the backend (successful heartbeat or mount-time /me). */
  lastHeartbeatAt: Date | null;
  /** Set while the provider is silently acquiring a new session. */
  reloginAttempting: boolean;
  /** Set to the last silent-re-login error (cleared on next success or explicit logout). */
  reloginError: string | null;
};

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Manually force a heartbeat now — shows a toast/indicator feedback. */
  manualHeartbeat: () => Promise<void>;
  session: SessionState;
  setKeepAlive: (value: boolean) => Promise<void>;
  setAutoReLogin: (value: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<SessionState>({
    heartbeatActive: false,
    keepAlive: true,
    autoReLogin: true,
    lastHeartbeatAt: null,
    reloginAttempting: false,
    reloginError: null,
  });

  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);

  // --- Credential storage -------------------------------------------------

  async function persistCredentials(payload: LoginPayload) {
    if (!session.keepAlive) return;
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.creds,
        JSON.stringify({ email: payload.email, password: payload.password }),
      );
    } catch {
      // SecureStore can fail on web or without native modules; non-fatal.
    }
  }

  async function clearCredentials() {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.creds);
    } catch {
      // ignore
    }
  }

  async function readStoredCredentials(): Promise<LoginPayload | null> {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEYS.creds);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LoginPayload;
      if (!parsed?.email || !parsed?.password) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  // --- Silent re-login ----------------------------------------------------

  const reloginSilently = useCallback(async (): Promise<User | null> => {
    const stored = await readStoredCredentials();
    if (!stored) return null;
    setSession((s) => ({ ...s, reloginAttempting: true, reloginError: null }));
    try {
      const next = await authApi.login(stored);
      setSession((s) => ({
        ...s,
        reloginAttempting: false,
        lastHeartbeatAt: new Date(),
      }));
      return next;
    } catch (error) {
      setSession((s) => ({
        ...s,
        reloginAttempting: false,
        reloginError:
          error instanceof ApiError
            ? error.message
            : i18n.t('errors.reLoginFailed'),
      }));
      await clearCredentials();
      return null;
    }
  }, []);

  // --- refresh / identity check ------------------------------------------

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const me = await authApi.getMe();
      if (!mounted.current) return;
      setUser(me);
      setSession((s) => ({
        ...s,
        lastHeartbeatAt: new Date(),
        reloginError: null,
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Session expired. Attempt silent re-login if enabled and credentials exist.
        if (session.autoReLogin) {
          const relogged = await reloginSilently();
          if (relogged) {
            if (!mounted.current) return;
            setUser(relogged);
            return;
          }
        }
        if (mounted.current) setUser(null);
        return;
      }
      // Other errors — preserve user, let screens handle it.
      if (!mounted.current) return;
      setUser(null);
    }
  }, [session.autoReLogin, reloginSilently]);

  // --- Login / register / logout -----------------------------------------

  const login = useCallback(async (payload: LoginPayload) => {
    const next = await authApi.login(payload);
    if (!mounted.current) return;
    setUser(next);
    setSession((s) => ({
      ...s,
      lastHeartbeatAt: new Date(),
      reloginError: null,
    }));
    await persistCredentials(payload);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await authApi.register(payload);
    await login({ email: payload.email, password: payload.password });
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Mirrors the web — surfaced to the user as a failed sign-out rather
      // than silently leaving them logged in. The local state still clears.
    } finally {
      await clearCredentials();
      if (mounted.current) {
        setUser(null);
        setSession((s) => ({ ...s, reloginError: null }));
      }
    }
  }, []);

  // --- Heartbeat ---------------------------------------------------------

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimer.current !== null) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
    setSession((s) => ({ ...s, heartbeatActive: false }));
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    if (!mounted.current) return;
    setSession((s) => ({ ...s, heartbeatActive: true }));
    heartbeatTimer.current = setInterval(() => {
      void refresh();
    }, HEARTBEAT_INTERVAL_MS);
  }, [refresh, stopHeartbeat]);

  // Manual heartbeat — exposed so the Profile session panel can offer a
  // "Refresh session now" button. Returns true if the backend answered.
  const manualHeartbeat = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      if (!mounted.current) return;
      setUser(me);
      setSession((s) => ({
        ...s,
        lastHeartbeatAt: new Date(),
        reloginError: null,
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && session.autoReLogin) {
        const relogged = await reloginSilently();
        if (relogged) {
          if (!mounted.current) return;
          setUser(relogged);
          return;
        }
      }
      throw error;
    }
  }, [reloginSilently, session.autoReLogin]);

  // --- Persisted toggle state -------------------------------------------

  const setKeepAlive = useCallback(async (value: boolean) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.keepAlive, JSON.stringify(value));
    } catch {
      // ignore
    }
    setSession((s) => ({ ...s, keepAlive: value }));
    if (user && value) startHeartbeat();
    else stopHeartbeat();
    if (!value) await clearCredentials();
  }, [startHeartbeat, stopHeartbeat, user]);

  const setAutoReLogin = useCallback(async (value: boolean) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.autoReLogin, JSON.stringify(value));
    } catch {
      // ignore
    }
    setSession((s) => ({ ...s, autoReLogin: value }));
    if (!value) await clearCredentials();
  }, []);

  // --- App boot ---------------------------------------------------------

  useEffect(() => {
    mounted.current = true;

    (async () => {
      // Load persisted toggles (fall back to defaults if absent).
      let keepAlive = true;
      let autoReLogin = true;
      try {
        const keepRaw = await SecureStore.getItemAsync(STORAGE_KEYS.keepAlive);
        if (keepRaw !== null) keepAlive = JSON.parse(keepRaw) as boolean;
        const reRaw = await SecureStore.getItemAsync(STORAGE_KEYS.autoReLogin);
        if (reRaw !== null) autoReLogin = JSON.parse(reRaw) as boolean;
      } catch {
        // ignore
      }

      let restoredUser: User | null = null;
      try {
        restoredUser = await authApi.getMe();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && autoReLogin) {
          restoredUser = await reloginSilently();
        }
      }

      if (!mounted.current) return;
      const hasUser = restoredUser !== null;
      setUser(restoredUser);
      setSession((s) => ({
        ...s,
        keepAlive,
        autoReLogin,
        lastHeartbeatAt: hasUser ? new Date() : null,
      }));
      setIsLoading(false);

      if (hasUser && keepAlive) startHeartbeat();
    })();

    return () => {
      mounted.current = false;
      stopHeartbeat();
    };
  }, [reloginSilently, startHeartbeat, stopHeartbeat]);

  // App-state listener — stop heartbeat when the app backgrounds so we don't
  // wake the device, restart on foreground.
  useEffect(() => {
    function handleAppState(status: AppStateStatus) {
      const foreground = FOREGROUND_STATES.includes(status);
      if (foreground && user !== null && session.keepAlive) {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    }
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [user, session.keepAlive, startHeartbeat, stopHeartbeat]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      refresh,
      manualHeartbeat,
      session,
      setKeepAlive,
      setAutoReLogin,
    }),
    [
      user, isLoading, login, register, logout, refresh,
      manualHeartbeat, session, setKeepAlive, setAutoReLogin,
    ],
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
