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
  signInWithEmail,
  signUpWithEmail,
  signOut as fbSignOut,
  getIdToken,
} from "@/lib/firebase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signInEmail: async () => {},
  signUpEmail: async () => {},
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
        if (u) {
          // Fire-and-forget: claims any guest-checkout hearts bought under
          // this email before this sign-in. Firestore's own onSnapshot
          // listener (useHearts) picks up the credited balance automatically.
          u.getIdToken()
            .then((token) =>
              fetch("/api/auth/sync", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              })
            )
            .catch(() => {});
        }
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

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email, password);
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string) => {
    await signUpWithEmail(email, password);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut();
  }, []);

  const getToken = useCallback(() => getIdToken(), []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signInEmail, signUpEmail, signOut, getToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
