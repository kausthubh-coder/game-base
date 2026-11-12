/// <reference types="vite/client" />

// What Vite reads from `.env.local` into the browser's script. Only names that start with VITE_ get there.
// Each one may be missing: the game runs without them, and everyone plays as a guest (.env.example).
interface ImportMetaEnv {
  /** Clerk's publishable key. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  /** The Convex deployment's address. */
  readonly VITE_CONVEX_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
