"use client";

// =============================================================================
// LOGIN GATE + USER BADGE
// -----------------------------------------------------------------------------
// LoginGate: a friendly Hebrew panel shown when a guest tries to generate.
// UserBadge: shows avatar/name + sign-out for authenticated users.
// =============================================================================

import { useAuth } from "./AuthProvider";

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
  const { signIn } = useAuth();
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
        onClick={() => signIn()}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--radius)] font-semibold text-white"
        style={{ background: "var(--ink)" }}
      >
        <GoogleMark />
        התחברות עם Google
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
