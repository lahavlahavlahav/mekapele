"use client";

// =============================================================================
// LOGIN GATE + USER BADGE
// -----------------------------------------------------------------------------
// LoginGate: a friendly Hebrew panel shown when a guest tries to generate.
// Supports Google sign-in and Email/Password (sign in or create account).
// UserBadge: shows avatar/name + sign-out for authenticated users.
// =============================================================================

import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

/** Firebase Auth error codes → friendly Hebrew messages. */
function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "כתובת האימייל הזו כבר רשומה. נסו להתחבר במקום להירשם.";
    case "auth/invalid-email":
      return "כתובת האימייל אינה תקינה.";
    case "auth/weak-password":
      return "הסיסמה חלשה מדי (לפחות 6 תווים).";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "אימייל או סיסמה שגויים.";
    case "auth/too-many-requests":
      return "יותר מדי ניסיונות. נסו שוב מאוחר יותר.";
    default:
      return "ההתחברות נכשלה. נסו שוב.";
  }
}

export function UserBadge() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2">
      {user.photoURL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.photoURL}
          alt=""
          className="h-7 w-7 rounded-full"
          referrerPolicy="no-referrer"
        />
      )}
      <span className="text-sm text-[var(--ink-soft)] hidden sm:inline">
        {user.displayName ?? user.email}
      </span>
      <button
        onClick={() => signOut()}
        className="text-sm px-3 py-1.5 rounded-lg border"
        style={{ borderColor: "var(--line)" }}
      >
        התנתקות
      </button>
    </div>
  );
}

export function LoginGate({ message }: { message?: string }) {
  const { signIn, signInEmail, signUpEmail } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signUpEmail(email, password);
      else await signInEmail(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-[var(--radius)] p-6 text-center"
      style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
    >
      <p className="font-display text-xl mb-1">נדרשת התחברות</p>
      <p className="text-sm text-[var(--ink-soft)] mb-4">
        {message ??
          "כדי לייצר את המדידות המדויקות יש להתחבר. התצוגה המקדימה זמינה לכולם."}
      </p>

      <button
        onClick={() => signIn().catch((err) => setError(authErrorMessage(err)))}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--radius)] font-semibold text-white mb-4"
        style={{ background: "var(--ink)" }}
      >
        <GoogleMark />
        התחברות עם Google
      </button>

      <div className="flex items-center gap-3 mb-4 text-xs text-[var(--ink-soft)]">
        <span className="flex-1 h-px" style={{ background: "var(--line)" }} />
        או
        <span className="flex-1 h-px" style={{ background: "var(--line)" }} />
      </div>

      <form onSubmit={onSubmit} className="text-right space-y-2.5 max-w-xs mx-auto">
        <input
          type="email"
          required
          placeholder="אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)]"
          style={{ borderColor: "var(--line)" }}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="סיסמה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)]"
          style={{ borderColor: "var(--line)" }}
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-lg font-semibold border disabled:opacity-60"
          style={{ borderColor: "var(--line)" }}
        >
          {busy
            ? "רגע…"
            : mode === "signup"
              ? "יצירת חשבון"
              : "התחברות עם אימייל"}
        </button>
      </form>

      {error && (
        <p
          className="mt-3 text-sm rounded-lg px-3 py-2"
          style={{ background: "rgba(226,97,74,0.12)", color: "var(--coral-deep)" }}
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "signin" ? "signup" : "signin"));
          setError(null);
        }}
        className="mt-3 text-sm font-semibold"
        style={{ color: "var(--coral-deep)" }}
      >
        {mode === "signin" ? "אין לך חשבון? הרשמה" : "כבר יש לך חשבון? התחברות"}
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 4.1 29.3 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22 22-9.8 22-22c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 4.1 29.3 2 24 2 16.3 2 9.7 6.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 46c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36.9 26.7 38 24 38c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 41.6 16.2 46 24 46z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C39.9 36.4 46 31 46 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
