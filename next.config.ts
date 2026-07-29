import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin pulls in @grpc/grpc-js and native/proto assets that
  // Next's default bundler doesn't package correctly for the Vercel
  // serverless runtime unless explicitly marked external — without this,
  // every route that touches Firebase Admin (auth, Firestore) 500s with
  // "Failed to load external module firebase-admin-...".
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
