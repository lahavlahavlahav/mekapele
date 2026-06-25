"use client";

// =============================================================================
// AUTH PROVIDER  (client)
// -----------------------------------------------------------------------------
// Exposes the current Firebase user, loading state, and sign-in/out actions to
// the whole app via React context. Also fetches a fresh ID token for API calls.
// =============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { User } from "firebase/auth";
import {
  watchAuth,
  signInWithGoogle,
  signOut as fbSignOut,
  getIdToken,
} from "@/lib/firebase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  getToken: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = watchAuth((u) => {
        setUser(u);
        setLoading(false);
      });
    } catch {
      // Firebase not configured yet (no env vars) — run in guest-only mode.
      setLoading(false);
    }
    return () => unsub();
  }, []);

  const signIn = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut();
  }, []);

  const getToken = useCallback(() => getIdToken(), []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
