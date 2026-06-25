// =============================================================================
// FIREBASE CLIENT SDK  (browser)
// -----------------------------------------------------------------------------
// Only the public web config lives here. These NEXT_PUBLIC_* values are not
// secrets — they identify the project and are safe in the browser. Real
// protection comes from Firestore Security Rules + server-side token checks,
// NOT from hiding this config.
//
// Initialization is LAZY so that builds / prerenders without env vars present
// don't crash; auth is only touched in the browser at runtime.
// =============================================================================

"use client";

import { getApps, getApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onIdTokenChanged,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

function firebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function app(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig());
  return _app;
}
export function getAuthClient(): Auth {
  if (!_auth) _auth = getAuth(app());
  return _auth;
}
export function getDbClient(): Firestore {
  if (!_db) _db = getFirestore(app());
  return _db;
}

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(getAuthClient(), googleProvider);
  return result.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(getAuthClient());
}

/** Subscribe to auth state; fires on login, logout, and token refresh. */
export function watchAuth(cb: (user: User | null) => void) {
  return onIdTokenChanged(getAuthClient(), cb);
}

/** Fresh ID token to send as Bearer on API calls. */
export async function getIdToken(): Promise<string | null> {
  const user = getAuthClient().currentUser;
  return user ? user.getIdToken() : null;
}
