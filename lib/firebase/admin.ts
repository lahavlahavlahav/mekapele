// =============================================================================
// FIREBASE ADMIN SDK  (SERVER-ONLY — never imported by client code)
// -----------------------------------------------------------------------------
// Uses a service-account credential supplied via env vars. These secrets must
// NEVER reach the browser. Admin bypasses Firestore security rules, so it is
// the ONLY place allowed to mutate protected fields like `credits` /
// `subscriptionTier`.
//
// Initialization is LAZY: the app is built on first use at request time, not at
// import/build time. This lets `next build` collect routes without needing the
// secrets present in the build environment.
//
// Required env vars (set in Vercel project settings, NOT NEXT_PUBLIC_*):
//   FIREBASE_ADMIN_PROJECT_ID
//   FIREBASE_ADMIN_CLIENT_EMAIL
//   FIREBASE_ADMIN_PRIVATE_KEY   (paste the full key; \n escapes are handled)
// =============================================================================

import "server-only";
import {
  getApps,
  initializeApp,
  cert,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _app: App | null = null;

function getAdminApp(): App {
  if (_app) return _app;
  const existing = getApps();
  if (existing.length) {
    _app = existing[0];
    return _app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_ADMIN_* env vars."
    );
  }

  _app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return _app;
}

// Lazy accessors — call these inside request handlers, not at module top level.
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
