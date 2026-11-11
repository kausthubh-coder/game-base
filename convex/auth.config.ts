// Clerk is the one issuer Convex trusts. The browser shows Convex the session token Clerk gave it, and
// `ctx.auth.getUserIdentity()` is null for anything else.
//
// CLERK_JWT_ISSUER_DOMAIN is the Clerk instance's Frontend API URL, set on the deployment with
// `bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://<name>.clerk.accounts.dev`. `applicationID` is the
// token's `aud` claim, which Clerk's Convex integration sets to `convex` (convex/README.md).
import type { AuthConfig } from 'convex/server';

/** The deployment's environment variables. Declared here because the Convex runtime is not Node and has no types for it. */
declare const process: { env: Record<string, string | undefined> };

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig;
